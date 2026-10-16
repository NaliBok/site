'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { WebSocketServer, WebSocket } = require('ws');
const { Engine } = require('./game.js');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'players.json');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

function loadPlayers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Не удалось прочитать players.json:', error.message);
    return {};
  }
}

const engine = new Engine({ players: loadPlayers() });
let saveInProgress = false;
let saveRequested = false;

function savePlayers() {
  if (saveInProgress) {
    saveRequested = true;
    return;
  }
  saveInProgress = true;
  const temporary = DATA_FILE + '.tmp';
  const data = JSON.stringify(engine.exportPlayers());
  fs.writeFile(temporary, data, 'utf8', error => {
    if (error) {
      console.error('Не удалось записать сохранение:', error.message);
      saveInProgress = false;
      return;
    }
    fs.rename(temporary, DATA_FILE, renameError => {
      if (renameError) console.error('Не удалось обновить players.json:', renameError.message);
      saveInProgress = false;
      if (saveRequested) {
        saveRequested = false;
        savePlayers();
      }
    });
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

const server = http.createServer((request, response) => {
  const origin = request.headers.origin;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  let url;
  try { url = new URL(request.url, 'http://' + (request.headers.host || 'localhost')); }
  catch (_) { sendJson(response, 400, { ok: false, error: 'Некорректный URL' }); return; }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true, online: engine.sessions.size, timestamp: Date.now() });
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'Метод не поддерживается' });
    return;
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const allowedFiles = new Set(['/index.html', '/styles.css', '/client.js', '/game.js']);
  if (!allowedFiles.has(requestedPath)) {
    sendJson(response, 404, { ok: false, error: 'Файл не найден' });
    return;
  }
  const filePath = path.join(ROOT, requestedPath.slice(1));
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 500, { ok: false, error: 'Не удалось прочитать файл' });
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    response.end(content);
  });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
server.on('upgrade', (request, socket, head) => {
  let pathname = '';
  try { pathname = new URL(request.url, 'http://' + (request.headers.host || 'localhost')).pathname; }
  catch (_) { socket.destroy(); return; }
  if (pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, websocket => {
    wss.emit('connection', websocket, request);
  });
});

wss.on('connection', websocket => {
  websocket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch (_) {
      if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify({ t: 'log', m: 'Сообщение не распознано.', k: 'bad' }));
      return;
    }
    engine.handle(message, websocket, output => {
      if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify(output));
    });
    savePlayers();
  });
  websocket.on('close', () => {
    engine.disconnect(websocket);
    savePlayers();
  });
  websocket.on('error', error => {
    console.warn('WebSocket:', error.message);
  });
});

const tickTimer = setInterval(() => {
  engine.tick();
}, 1000);
const saveTimer = setInterval(savePlayers, 5000);

server.listen(PORT, HOST, () => {
  console.log('Текстовая RPG запущена на ' + HOST + ':' + PORT);
  console.log('Проверка доступности: http://localhost:' + PORT + '/health');
  console.log('WebSocket: ws://localhost:' + PORT + '/ws');
});

function shutdown() {
  clearInterval(tickTimer);
  clearInterval(saveTimer);
  savePlayers();
  wss.clients.forEach(client => client.close());
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
