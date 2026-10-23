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
  return {
    code: room.code,
    hostId: room.hostId,
    hostName: room.players.find(p => p.id === room.hostId)?.name || 'Хост',
    mapSize: room.mapSize,
    maxPlayers: room.maxPlayers,
    started: room.started,
    finished: room.finished,
    closed: room.closed,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    players: room.players.map(p => ({ id: p.id, name: p.name, tribe: p.tribe, tribeName: Engine.TRIBES.find(t => t.id === p.tribe)?.name || p.tribe, isHost: p.id === room.hostId, connected: true }))
  };
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
  return {
    name: cleanText(body.name, 'Игрок 1'),
    tribe: cleanTribe(body.tribe),
    mapSize: [11, 14, 16, 19, 22, 30].includes(mapSize) ? mapSize : 16,
    maxPlayers: Math.max(2, Math.min(8, Number(body.maxPlayers) || 4)),
    gameMode: body.gameMode === 'SCORE' ? 'SCORE' : 'DOMINATION'
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
      json(res, 200, { ok: true, online: onlineCount(), rooms: rooms.size, timestamp: Date.now(), version: '1.0.0' });
    } else if (req.method === 'GET' && path === '/api/rooms') {
      const open = [...rooms.values()].filter(r => !r.started && !r.closed && r.players.length < r.maxPlayers).map(roomSummary);
      json(res, 200, { ok: true, rooms: open });
    } else if (req.method === 'POST' && path === '/api/rooms') {
      const body = await readBody(req);
      const options = sanitizeOptions(body);
      const code = newCode();
      const now = Date.now();
      const player = { id: 1, token: crypto.randomBytes(24).toString('hex'), name: options.name, tribe: options.tribe };
      const room = {
        code, hostId: 1, players: [player], mapSize: options.mapSize, maxPlayers: options.maxPlayers,
        gameMode: options.gameMode, started: false, finished: false, closed: false, game: null,
        createdAt: now, updatedAt: now
      };
      rooms.set(code, room);
      json(res, 201, { ok: true, code, playerId: player.id, playerToken: player.token, room: roomSummary(room) });
    } else {
      const joinMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);
      const startMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/start$/i);
      const actionMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/action$/i);
      const endMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)\/end-turn$/i);
      const roomMatch = path.match(/^\/api\/rooms\/([A-Z0-9]+)$/i);

      if (req.method === 'POST' && joinMatch) {
        const room = getRoom(joinMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        if (room.started) throw Object.assign(new Error('Матч уже начался. Новые игроки не могут присоединиться.'), { status: 409 });
        if (room.players.length >= room.maxPlayers) throw Object.assign(new Error('В комнате нет свободных мест.'), { status: 409 });
        const body = await readBody(req);
        const options = sanitizeOptions({ name: body.name, tribe: body.tribe, mapSize: room.mapSize, maxPlayers: room.maxPlayers });
        if (room.players.some(p => p.name.toLowerCase() === options.name.toLowerCase())) {
          // Names need not be globally unique, but disambiguate them in the lobby.
          options.name = `${options.name} ${room.players.length + 1}`.slice(0, 22);
        }
        const player = { id: room.players.length + 1, token: crypto.randomBytes(24).toString('hex'), name: options.name, tribe: options.tribe };
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
          const configs = room.players.map(p => ({ name: p.name, tribe: p.tribe, isAI: false, connected: true }));
          room.game = Engine.createGame({ mapSize: room.mapSize, players: configs, gameMode: room.gameMode });
          room.started = true; room.updatedAt = Date.now();
          json(res, 200, { ok: true, room: roomSummary(room), state: roomStateFor(room, player.id) });
        }
      } else if (req.method === 'GET' && roomMatch) {
        const room = getRoom(roomMatch[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        room.updatedAt = Date.now();
        const rawPlayer = url.searchParams.get('playerId');
        const rawToken = url.searchParams.get('playerToken');
        if (rawPlayer) requireRoomPlayer(room, rawPlayer, rawToken);
        json(res, 200, { ok: true, room: roomSummary(room), playerId: rawPlayer ? Number(rawPlayer) : null, state: rawPlayer ? roomStateFor(room, rawPlayer) : null });
      } else if (req.method === 'POST' && (actionMatch || endMatch)) {
        const match = actionMatch || endMatch;
        const room = getRoom(match[1]);
        if (!room || room.closed) throw Object.assign(new Error('Комната не найдена или закрыта.'), { status: 404 });
        if (!room.started || !room.game) throw Object.assign(new Error('Матч ещё не начался. Дождитесь создателя комнаты.'), { status: 409 });
        const body = await readBody(req);
        const player = requireRoomPlayer(room, body.playerId, body.playerToken);
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
        room.finished = !!room.game.over;
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
setInterval(pruneRooms, 10 * 60 * 1000).unref();

module.exports = { server, rooms };
