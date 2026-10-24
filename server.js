'use strict';

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const Engine = require('./game.js');
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const rooms = new Map();
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  });
  res.end(payload);
}
function cleanText(value, fallback, max = 22) {
  const s = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (s || fallback).slice(0, max);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function cleanTribe(value) {
  const s = String(value || 'IMPERIUS').toUpperCase();
  return Engine.TRIBES.some(t => t.id === s) ? s : 'IMPERIUS';
}
function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 30; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function onlineCount() {
  let count = 0;
  for (const room of rooms.values()) if (!room.closed) count += room.players.length;
  return count;
}
function getRoom(code) { return rooms.get(String(code || '').toUpperCase()); }
function roomSummary(room) {
  const now = Date.now();
  return {
    code: room.code, hostId: room.hostId,
    hostName: room.players.find(p => p.id === room.hostId)?.name || 'Хост',
    roomName: room.roomName || 'Новая партия', mapSize: room.mapSize, mapType: room.mapType || 'CONTINENT',
    maxPlayers: room.maxPlayers, started: room.started, finished: room.finished, closed: room.closed,
    paused: !!room.paused, privacy: room.privacy || 'PUBLIC', spectators: room.spectators !== false,
    spectatorDelay: Number(room.spectatorDelay || 0), allowPause: room.allowPause !== false,
    timeLimitSeconds: Number(room.timeLimitSeconds || 0), replacePolicy: room.replacePolicy || 'BOT',
    createdAt: room.createdAt, updatedAt: room.updatedAt,
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.id === room.hostId, isAI: !!p.isAI,
      connected: !!p.isAI || now - Number(p.lastSeen || 0) < 45000 }))
  };
}
function snapshotRoom(room) {
  if (!room.game) return;
  room.history = room.history || [];
  room.history.push({ turn: room.game.turn, savedAt: Date.now(), state: clone(room.game) });
  if (room.history.length > 600) room.history = room.history.slice(-600);
}
function spectatorStateFor(room) {
  if (room.spectators === false) throw Object.assign(new Error('Наблюдение запрещено создателем комнаты.'), { status: 403 });
  if (!room.game || !room.started) return null;
  const delay = Math.max(0, Math.min(100, Number(room.spectatorDelay) || 0));
  const targetTurn = Math.max(1, Number(room.game.turn) - delay);
  const history = room.history || [];
  const available = history.filter(item => item.turn <= targetTurn);
  return clone((available.length ? available[available.length - 1] : history[0])?.state || room.game);
}
function runRoomBotTurn(room, playerId) {
  if (!room.game || room.game.over || Number(room.game.activePlayer) !== Number(playerId)) return;
  const p = Engine.playerById(room.game, playerId);
  if (!p || !p.isAI) return;
  try { Engine.aiTurn(room.game, playerId); Engine.endTurn(room.game, playerId); } catch (_) {}
  room.turnStartedAt = Date.now(); room.updatedAt = Date.now(); room.finished = !!room.game.over;
  snapshotRoom(room);
}
function advanceAutomatedTurns(room) {
  if(!room.game || room.game.over) return;
  for(let i=0;i<room.players.length && !room.game.over;i++) {
    const id=room.game.activePlayer, p=Engine.playerById(room.game,id);
    if(!p || !p.isAI) break;
    try { Engine.aiTurn(room.game,id); Engine.endTurn(room.game,id); } catch (_) { break; }
    room.turnStartedAt=Date.now(); room.updatedAt=Date.now(); room.finished=!!room.game.over; snapshotRoom(room);
  }
}
function requireRoomPlayer(room, playerId, playerToken) {
  const id = Number(playerId);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('Неверный идентификатор игрока.'), { status: 400 });
  const player = room.players.find(p => p.id === id);
  if (!player) throw Object.assign(new Error('Этот игрок не состоит в комнате.'), { status: 403 });
  if (typeof playerToken !== 'string' || playerToken.length < 32 || playerToken !== player.token) throw Object.assign(new Error('Не удалось подтвердить доступ к месту игрока. Переподключитесь к комнате.'), { status: 403 });
  return player;
}
function sanitizeOptions(body) {
  const mapSize = Number(body.mapSize);
  const mapType = ['ISLANDS','CONTINENT','PANGAEA','LAKES','ARCHIPELAGO','CUSTOM'].includes(body.mapType) ? body.mapType : 'CONTINENT';
  let customWorld = null;
  if (Array.isArray(body.customWorld) && body.customWorld.length >= 7 && body.customWorld.length <= 60 && body.customWorld.every(row => typeof row === 'string' && row.length === body.customWorld.length && /^[~w.T^ ]+$/.test(row))) customWorld = body.customWorld;
  if (mapType === 'CUSTOM' && !customWorld) throw Object.assign(new Error('Для своего мира передайте квадратную ASCII-карту 7–60 клеток.'), { status: 400 });
  const safeMapSize = customWorld ? customWorld.length : Math.max(7, Math.min(60, Number.isFinite(mapSize) ? Math.floor(mapSize) : 16));
  return {
    name: cleanText(body.name, 'Игрок 1'), tribe: cleanTribe(body.tribe), mapSize: safeMapSize, mapType,
    customWorld: mapType === 'CUSTOM' ? customWorld : null, seed: Number.isFinite(Number(body.seed)) && Number(body.seed) ? Number(body.seed) : undefined,
    roomName: cleanText(body.roomName, 'Новая партия', 40),
    privacy: body.privacy === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    spectators: body.spectators !== false, spectatorDelay: Math.max(0, Math.min(100, Number(body.spectatorDelay) || 0)),
    replacePolicy: ['ASK','BOT','WAIT'].includes(body.replacePolicy) ? body.replacePolicy : 'BOT',
    allowPause: body.allowPause !== false, timeLimitSeconds: [0,60,120,180,300,600].includes(Number(body.timeLimitSeconds)) ? Number(body.timeLimitSeconds) : 0,
    maxPlayers: Math.max(2, Math.min(8, Number(body.maxPlayers) || 4)),
    gameMode: body.gameMode === 'SCORE' ? 'SCORE' : 'DOMINATION',
    bannedTribes: Array.isArray(body.bannedTribes) ? body.bannedTribes.filter(id => Engine.TRIBES.some(t => t.id === id)).slice(0, 10) : []
  };
}
async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Запрос слишком большой.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) { throw Object.assign(new Error('Тело запроса должно быть JSON.'), { status: 400 }); }
}
function roomStateFor(room, playerId) {
  if (!room.game || !room.started) return null;
  try { return Engine.getPlayerView(room.game, Number(playerId)); }
  catch (_) { return null; }
}
function pruneRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.updatedAt > ROOM_TTL_MS) rooms.delete(code);
  }
  // Bound memory use if the service is left running for a long time.
  if (rooms.size > 500) {
    const oldest = [...rooms.values()].sort((a, b) => a.updatedAt - b.updatedAt).slice(0, rooms.size - 500);
    oldest.forEach(room => rooms.delete(room.code));
  }
}

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && (path === '/' || path === '/api/status' || path === '/api/ping')) {
      json(res, 200, { ok: true, online: onlineCount(), rooms: rooms.size, timestamp: Date.now(), version: '2.0.0' });
    } else if (req.method === 'GET' && path === '/api/rooms') {
      const open = [...rooms.values()].filter(r => !r.closed && r.privacy !== 'PRIVATE').sort((a,b)=>b.updatedAt-a.updatedAt).map(roomSummary);
      json(res, 200, { ok: true, rooms: open });
    } else if (req.method === 'POST' && path === '/api/rooms') {
      const body = await readBody(req);
      const options = sanitizeOptions(body);
      if (options.bannedTribes.includes(options.tribe)) throw Object.assign(new Error('Выбранное племя запрещено настройками комнаты.'), { status: 400 });
      const code = newCode();
      const now = Date.now();
      const player = { id: 1, token: crypto.randomBytes(24).toString('hex'), name: options.name, tribe: options.tribe, isAI: false, lastSeen: now };
      const room = {
        code, hostId: 1, players: [player], mapSize: options.mapSize, mapType: options.mapType, customWorld: options.customWorld, seed: options.seed,
        roomName: options.roomName, privacy: options.privacy, spectators: options.spectators, spectatorDelay: options.spectatorDelay,
        replacePolicy: options.replacePolicy, allowPause: options.allowPause, timeLimitSeconds: options.timeLimitSeconds, bannedTribes: options.bannedTribes,
        maxPlayers: options.maxPlayers, gameMode: options.gameMode, started: false, paused: false, finished: false, closed: false, game: null,
        createdAt: now, updatedAt: now, turnStartedAt: now, history: []
      };
      rooms.set(code, room);
      json(res, 201, { ok: true, code, playerId: player.id, playerToken: player.token, room: roomSummary(room) });
    } else {
      const joinMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);
      const startMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/start$/i);
      const actionMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/action$/i);
      const endMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/end-turn$/i);
      const roomMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)$/i);
      const spectatorMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/spectate$/i);
      const controlMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/(pause|resume|replace|recreate|close)$/i);

      if (req.method === 'POST' && joinMatch) {
        const room = getRoom(joinMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        if (room.started) throw Object.assign(new Error('Матч уже начался. Новые игроки не могут присоединиться.'), { status: 409 });
        if (room.players.length >= room.maxPlayers) throw Object.assign(new Error('В комнате нет свободных мест.'), { status: 409 });
        const body = await readBody(req);
        const options = sanitizeOptions({ name: body.name, tribe: body.tribe, mapSize: room.mapSize, maxPlayers: room.maxPlayers });
        if (room.bannedTribes?.includes(options.tribe)) throw Object.assign(new Error('Это племя запрещено настройками комнаты.'), { status: 409 });
        if (room.players.some(p => p.name.toLowerCase() === options.name.toLowerCase())) {
          // Names need not be globally unique, but disambiguate them in the lobby.
          options.name = `${options.name} ${room.players.length + 1}`.slice(0, 22);
        }
        const player = { id: room.players.length + 1, token: crypto.randomBytes(24).toString('hex'), name: options.name, tribe: options.tribe, isAI: false, lastSeen: Date.now() };
        room.players.push(player); room.updatedAt = Date.now();
        json(res, 200, { ok: true, code: room.code, playerId: player.id, playerToken: player.token, room: roomSummary(room) });
      } else if (req.method === 'POST' && startMatch) {
        const room = getRoom(startMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        const body = await readBody(req);
        const player = requireRoomPlayer(room, body.playerId, body.playerToken);
        if (player.id !== room.hostId) throw Object.assign(new Error('Начать матч может только создатель комнаты.'), { status: 403 });
        if (room.started) {
          json(res, 200, { ok: true, room: roomSummary(room), state: roomStateFor(room, player.id) });
        } else {
          if (room.players.length < 2) throw Object.assign(new Error('Для начала нужны минимум два игрока.'), { status: 409 });
          const configs = room.players.map(p => ({ name: p.name, tribe: p.tribe, isAI: !!p.isAI, connected: !p.isAI, aiType: p.aiType || 'BALANCED', difficulty: p.difficulty || 'NORMAL' }));
          room.game = Engine.createGame({ mapSize: room.mapSize, mapType: room.mapType, customWorld: room.customWorld, seed: room.seed, players: configs, gameMode: room.gameMode });
          room.started = true; room.paused = false; room.turnStartedAt = Date.now(); room.updatedAt = Date.now(); snapshotRoom(room);
          json(res, 200, { ok: true, room: roomSummary(room), state: roomStateFor(room, player.id) });
        }
      } else if (req.method === 'GET' && spectatorMatch) {
        const room = getRoom(spectatorMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        json(res, 200, { ok: true, room: roomSummary(room), state: spectatorStateFor(room) });
      } else if (req.method === 'GET' && roomMatch) {
        const room = getRoom(roomMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        const rawPlayer = url.searchParams.get('playerId');
        const rawToken = url.searchParams.get('playerToken');
        if (rawPlayer) { const player = requireRoomPlayer(room, rawPlayer, rawToken); player.lastSeen = Date.now(); }
        room.updatedAt = Date.now();
        json(res, 200, { ok: true, room: roomSummary(room), playerId: rawPlayer ? Number(rawPlayer) : null, state: rawPlayer ? roomStateFor(room, rawPlayer) : null });
      } else if (req.method === 'POST' && controlMatch) {
        const room = getRoom(controlMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        const body = await readBody(req); const actor=requireRoomPlayer(room,body.playerId,body.playerToken);
        if(actor.id!==room.hostId) throw Object.assign(new Error('Управлять комнатой может только хост.'), {status:403});
        const action=controlMatch[2];
        if(action==='pause') { if(!room.allowPause) throw Object.assign(new Error('Пауза запрещена настройками комнаты.'),{status:403}); if(!room.started) throw Object.assign(new Error('Матч ещё не начался.'),{status:409}); room.paused=true; }
        else if(action==='resume') { room.paused=false; room.turnStartedAt=Date.now(); }
        else if(action==='replace') {
          const target=room.players.find(p=>p.id===Number(body.targetPlayerId));
          if(!target||target.id===room.hostId) throw Object.assign(new Error('Нельзя заменить выбранного игрока.'),{status:400});
          target.isAI=true; target.aiType='BALANCED'; target.name=`${target.name} (бот)`.slice(0,40); target.token=null; target.lastSeen=0;
          if(room.game) { const gp=Engine.playerById(room.game,target.id); if(gp){gp.isAI=true;gp.connected=false;} if(room.game.activePlayer===target.id) runRoomBotTurn(room,target.id); advanceAutomatedTurns(room); }
        }
        else if(action==='recreate') { room.started=false; room.paused=false; room.finished=false; room.game=null; room.history=[]; room.turnStartedAt=Date.now(); room.players=room.players.map(p=>p.isAI? p : p); }
        else if(action==='close') { room.closed=true; room.updatedAt=Date.now(); }
        room.updatedAt=Date.now();
        json(res,200,{ok:true,room:roomSummary(room),state:actor.id?roomStateFor(room,actor.id):null});
      } else if (req.method === 'POST' && (actionMatch || endMatch)) {
        const match = actionMatch || endMatch;
        const room = getRoom(match[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        if (!room.started || !room.game) throw Object.assign(new Error('Матч ещё не начался. Дождитесь создателя комнаты.'), { status: 409 });
        if (room.paused) throw Object.assign(new Error('Комната на паузе.'), { status: 409 });
        const body = await readBody(req);
        const player = requireRoomPlayer(room, body.playerId, body.playerToken); player.lastSeen = Date.now();
        if (room.finished || room.game.over) throw Object.assign(new Error('Матч уже завершён.'), { status: 409 });
        if (room.game.activePlayer !== player.id) throw Object.assign(new Error('Сейчас ход другого игрока.'), { status: 409 });
        const gamePlayer = Engine.playerById(room.game, player.id);
        if (!gamePlayer || gamePlayer.isAI) throw Object.assign(new Error('Этот игрок не может выполнять действия.'), { status: 403 });
        try {
          if (endMatch) Engine.endTurn(room.game, player.id);
          else Engine.performAction(room.game, player.id, body.action || {});
        } catch (err) {
          throw Object.assign(err, { status: 400 });
        }
        room.updatedAt = Date.now();
        if(endMatch) room.turnStartedAt = Date.now();
        room.finished = !!room.game.over;
        if(endMatch) { snapshotRoom(room); advanceAutomatedTurns(room); }
        json(res, 200, { ok: true, room: roomSummary(room), state: roomStateFor(room, player.id) });
      } else {
        json(res, 404, { ok: false, error: 'Маршрут не найден.' });
      }
    }
    if (process.env.NODE_ENV !== 'test') {
      // Keep console logs concise on Render.
      console.log(`${req.method} ${path} ${res.statusCode || 200} ${Date.now() - start}ms`);
    }
  } catch (err) {
    const status = err.status || 400;
    json(res, status, { ok: false, error: err.message || 'Внутренняя ошибка сервера.' });
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.listen(PORT, HOST, () => {
  console.log(`Strategy server listening on ${HOST}:${PORT}`);
});
setInterval(() => {
  pruneRooms(); const now=Date.now();
  for (const room of rooms.values()) {
    if (!room.started || room.paused || room.finished || room.closed || !room.game || !room.timeLimitSeconds) continue;
    if (now - Number(room.turnStartedAt || room.updatedAt) < room.timeLimitSeconds * 1000) continue;
    const active=room.players.find(p=>p.id===room.game.activePlayer);
    if (!active) { try { Engine.endTurn(room.game,room.game.activePlayer); } catch (_) {} }
    else {
      if (!active.isAI && room.replacePolicy === 'BOT' && now - Number(active.lastSeen || 0) > 45000) {
        active.isAI=true; active.aiType='BALANCED'; active.name=`${active.name} (бот)`.slice(0,40); active.token=null;
        const gp=Engine.playerById(room.game,active.id); if(gp){gp.isAI=true;gp.connected=false;}
      }
      if (active.isAI) { runRoomBotTurn(room,active.id); advanceAutomatedTurns(room); continue; }
      else { try { Engine.endTurn(room.game,active.id); } catch (_) {} }
    }
    room.turnStartedAt=Date.now(); room.updatedAt=Date.now(); room.finished=!!room.game.over; snapshotRoom(room); advanceAutomatedTurns(room);
  }
}, 2000).unref();

module.exports = { server, rooms };
