(function () {
  'use strict';

  const TOKEN_KEY = 'text-rpg-token';
  const LOCAL_SAVE_KEY = 'text-rpg-local-save';
  const SERVER_KEY = 'text-rpg-server-url';
  const $ = id => document.getElementById(id);
  const loginScreen = $('loginScreen');
  const gameScreen = $('gameScreen');
  const serverUrlInput = $('serverUrl');
  const serverStatus = $('serverStatus');
  const serverCheckText = $('serverCheckText');
  const connectionLine = $('connectionLine');
  const logList = $('logList');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let mode = 'menu';
  let engine = null;
  let localPeer = null;
  let socket = null;
  let currentState = null;
  let autoSaveTimer = null;
  let offlineTickTimer = null;
  let reconnectTimer = null;
  let connectionTimeout = null;
  let probeController = null;
  let networkAttempt = 0;
  let everConnected = false;
  let leavingGame = false;
  let lastNetworkError = '';

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Storage may be disabled or full. */ }
  }

  function getToken() {
    let token = safeStorageGet(TOKEN_KEY);
    if (token) return token;
    try {
      token = crypto.randomUUID();
    } catch (_) {
      const bytes = new Uint8Array(16);
      try { crypto.getRandomValues(bytes); } catch (_) {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
      }
      token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    safeStorageSet(TOKEN_KEY, token);
    return token;
  }

  function cleanName(value) {
    return String(value || '').replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Путник';
  }

  function getServerBase() {
    let value = String(serverUrlInput.value || '').trim();
    if (!value) return '';
    value = value.replace(/\/+$/, '').replace(/\/ws$/, '').replace(/\/health$/, '');
    try {
      const url = new URL(value);
      if (!['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol)) return '';
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.href.replace(/\/$/, '');
    } catch (_) {
      return '';
    }
  }

  function toHttpUrl(base) {
    const url = new URL(base);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    return url.href.replace(/\/$/, '');
  }

  function toWebSocketUrl(base) {
    const url = new URL(base);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.href;
  }

  function updateServerPill(kind, text) {
    serverStatus.className = 'status-pill ' + (kind === 'up' ? 'status-up' : kind === 'down' ? 'status-down' : 'status-unknown');
    serverStatus.textContent = text;
  }

  async function probeServer() {
    const base = getServerBase();
    if (!base) {
      updateServerPill('down', 'Адрес не задан');
      serverCheckText.textContent = 'Укажите адрес сервера Render или локального сервера.';
      return false;
    }
    safeStorageSet(SERVER_KEY, base);
    if (probeController) probeController.abort();
    probeController = new AbortController();
    const controller = probeController;
    updateServerPill('unknown', 'Проверка…');
    serverCheckText.textContent = 'Ожидание ответа. Спящий сервер может запускаться около минуты.';
    const timeout = window.setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch(toHttpUrl(base) + '/health', {
        method: 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!data || data.ok !== true) throw new Error('Сервер не подтвердил готовность');
      updateServerPill('up', 'Сервер доступен');
      serverCheckText.textContent = 'Ответ получен. Можно подключаться.';
      return true;
    } catch (error) {
      updateServerPill('down', 'Сервер недоступен');
      serverCheckText.textContent = controller.signal.aborted
        ? 'Время ожидания истекло. Проверьте адрес и состояние сервиса.'
        : 'Нет ответа. Проверьте адрес; Render может ещё запускаться.';
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (probeController === controller) probeController = null;
    }
  }

  function appendLog(message, kind) {
    const item = document.createElement('li');
    const safeKind = ['good', 'bad', 'warn', 'hit', 'chat'].includes(kind) ? kind : 'warn';
    item.className = 'log-item ' + safeKind;
    const now = new Date();
    const stamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    item.textContent = '[' + stamp + '] ' + String(message == null ? '' : message);
    logList.appendChild(item);
    while (logList.children.length > 300) logList.removeChild(logList.firstChild);
    logList.scrollTop = logList.scrollHeight;
  }

  function receiveMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.t === 'log') appendLog(message.m, message.k);
    else if (message.t === 'st') {
      currentState = message;
      renderState(message);
      saveLocalProgress();
    }
  }

  function startTimers() {
    window.clearInterval(autoSaveTimer);
    window.clearInterval(offlineTickTimer);
    autoSaveTimer = window.setInterval(() => {
      saveLocalProgress();
      if (mode === 'online' && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ t: 'cmd', c: 'save', a: {} }));
      }
    }, 5000);
    if (mode === 'single' && engine) offlineTickTimer = window.setInterval(() => engine.tick(), 1000);
  }

  function stopTimers() {
    window.clearInterval(autoSaveTimer);
    window.clearInterval(offlineTickTimer);
    autoSaveTimer = null;
    offlineTickTimer = null;
  }

  function saveLocalProgress() {
    let player = null;
    if (engine && mode === 'single') player = engine.exportPlayer(getToken());
    else if (currentState && currentState.player) player = currentState.player;
    if (!player) return;
    try { safeStorageSet(LOCAL_SAVE_KEY, JSON.stringify(player)); } catch (_) { /* Ignore storage errors. */ }
  }

  function getLocalPlayerSave() {
    try {
      const raw = safeStorageGet(LOCAL_SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' && data.tok ? data : null;
    } catch (_) {
      return null;
    }
  }

  function showGame() {
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
  }

  function showMenu() {
    gameScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    connectionLine.textContent = '';
  }

  function startSinglePlayer() {
    cleanUpSession();
    mode = 'single';
    leavingGame = false;
    currentState = null;
    networkAttempt = 0;
    everConnected = false;
    lastNetworkError = '';
    logList.replaceChildren();
    const token = getToken();
    const saved = getLocalPlayerSave();
    const savedPlayers = saved && saved.tok === token ? { [token]: saved } : {};
    engine = new GameEngine.Engine({ players: savedPlayers });
    localPeer = { id: 'browser-single-player' };
    showGame();
    connectionLine.textContent = 'Одиночная игра · автосохранение';
    engine.handle({ t: 'join', name: cleanName($('playerName').value), cls: $('classSelect').value, tok: token }, localPeer, receiveMessage);
    startTimers();
  }

  function startMultiplayer() {
    const base = getServerBase();
    if (!base) {
      updateServerPill('down', 'Адрес не задан');
      serverCheckText.textContent = 'Сначала укажите WebSocket-адрес сервера.';
      serverUrlInput.focus();
      return;
    }
    safeStorageSet(SERVER_KEY, base);
    cleanUpSession();
    mode = 'online';
    leavingGame = false;
    currentState = null;
    engine = null;
    localPeer = null;
    networkAttempt = 0;
    everConnected = false;
    lastNetworkError = '';
    logList.replaceChildren();
    showGame();
    startTimers();
    connectOnline();
  }

  function connectOnline() {
    if (mode !== 'online' || leavingGame) return;
    const base = getServerBase();
    if (!base) {
      connectionLine.textContent = 'Переподключение невозможно: адрес сервера не задан.';
      scheduleReconnect();
      return;
    }
    networkAttempt += 1;
    const attemptText = everConnected ? 'переподключение… попытка ' : 'подключение… попытка ';
    connectionLine.textContent = attemptText + networkAttempt;
    if (socket) {
      try { socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null; socket.close(); } catch (_) { /* Ignore an already closed socket. */ }
      socket = null;
    }
    let wsUrl;
    try { wsUrl = toWebSocketUrl(base); }
    catch (_) {
      connectionLine.textContent = 'Некорректный адрес сервера.';
      scheduleReconnect();
      return;
    }
    try { socket = new WebSocket(wsUrl); }
    catch (error) {
      lastNetworkError = String(error && error.message || 'ошибка сети');
      scheduleReconnect();
      return;
    }
    const activeSocket = socket;
    connectionTimeout = window.setTimeout(() => {
      if (activeSocket.readyState === WebSocket.CONNECTING) {
        lastNetworkError = 'тайм-аут подключения';
        try { activeSocket.close(); } catch (_) { /* No action needed. */ }
      }
    }, 65000);
    activeSocket.onopen = () => {
      if (activeSocket !== socket || mode !== 'online') return;
      window.clearTimeout(connectionTimeout);
      window.clearTimeout(reconnectTimer);
      everConnected = true;
      lastNetworkError = '';
      connectionLine.textContent = 'Соединение установлено · загрузка персонажа…';
      activeSocket.send(JSON.stringify({
        t: 'join', name: cleanName($('playerName').value), cls: $('classSelect').value, tok: getToken()
      }));
    };
    activeSocket.onmessage = event => {
      if (activeSocket !== socket) return;
      try {
        const message = JSON.parse(event.data);
        receiveMessage(message);
      } catch (_) {
        appendLog('Получено некорректное сообщение сервера.', 'warn');
      }
    };
    activeSocket.onerror = () => {
      if (activeSocket === socket) lastNetworkError = 'ошибка соединения';
    };
    activeSocket.onclose = () => {
      window.clearTimeout(connectionTimeout);
      if (activeSocket !== socket || mode !== 'online' || leavingGame) return;
      if (everConnected) connectionLine.textContent = 'Переподключение… попытка ' + (networkAttempt + 1);
      else connectionLine.textContent = 'Сервер запускается или недоступен… попытка ' + (networkAttempt + 1);
      if (lastNetworkError) appendLog('Соединение прервано: ' + lastNetworkError + '.', 'warn');
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (mode !== 'online' || leavingGame) return;
    window.clearTimeout(reconnectTimer);
    const delay = Math.min(10000, 1200 + Math.max(0, networkAttempt - 1) * 950);
    reconnectTimer = window.setTimeout(connectOnline, delay);
    connectionLine.textContent = (everConnected ? 'Переподключение… попытка ' : 'Ожидание сервера… попытка ') + (networkAttempt + 1);
  }

  function cleanUpSession() {
    leavingGame = true;
    window.clearTimeout(reconnectTimer);
    window.clearTimeout(connectionTimeout);
    stopTimers();
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'cmd', c: 'save', a: {} }));
        socket.close();
      } catch (_) { /* The socket may already be gone. */ }
      socket = null;
    }
    socket = null;
    engine = null;
    localPeer = null;
    leavingGame = false;
  }

  function sendCommand(command, args) {
    const message = { t: 'cmd', c: command, a: args || {} };
    if (mode === 'single' && engine && localPeer) {
      engine.handle(message, localPeer, receiveMessage);
      return;
    }
    if (mode === 'online' && socket && socket.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify(message)); }
      catch (_) { appendLog('Не удалось отправить действие. Соединение восстанавливается.', 'warn'); }
      return;
    }
    appendLog('Нет соединения с сервером. Ожидайте переподключения.', 'warn');
  }

  function makeButton(text, className, onClick, disabled, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || 'button small-button';
    button.textContent = text;
    button.disabled = Boolean(disabled);
    if (title) button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }

  function setText(id, value) { $(id).textContent = String(value == null ? '' : value); }

  function setMeter(barId, value, max) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    $(barId).style.width = (ratio * 100) + '%';
  }

  function renderState(state) {
    const p = state.player;
    if (!p) return;
    if (mode === 'single') connectionLine.textContent = 'Одиночная игра · автосохранение';
    else if (socket && socket.readyState === WebSocket.OPEN) connectionLine.textContent = '● Сервер онлайн · игроков: ' + Number(state.online || 0);
    setText('playerNameLine', p.name);
    setText('playerMeta', p.className + ' · уровень ' + p.level);
    setText('goldLine', p.gold + ' зол.');
    setText('hpText', Math.floor(p.hp) + ' / ' + p.maxHp);
    setText('mpText', Math.floor(p.mp) + ' / ' + p.maxMp);
    setText('xpText', Math.floor(p.xp) + ' / ' + p.xpNeeded);
    setMeter('hpBar', p.hp, p.maxHp);
    setMeter('mpBar', p.mp, p.maxMp);
    setMeter('xpBar', p.xp, p.xpNeeded);
    const stats = $('statsLine');
    stats.replaceChildren();
    [ 'Атака ' + p.atk, 'Защита ' + p.def, 'КД ' + (p.cooldown || 0) ].forEach(label => {
      const chip = document.createElement('span');
      chip.className = 'stat-chip';
      chip.textContent = label;
      stats.appendChild(chip);
    });
    const effectNames = { stun: 'Оглушение', burn: 'Поджог', poison: 'Яд', evade: 'Уклонение' };
    const effectsLine = $('effectsLine');
    effectsLine.replaceChildren();
    (p.effectsList || []).forEach(effect => {
      const chip = document.createElement('span');
      chip.className = 'effect-chip';
      chip.textContent = (effectNames[effect.id] || effect.id) + ': ' + effect.turns;
      effectsLine.appendChild(chip);
    });
    setText('locationTitle', state.location.name);
    setText('locationLevel', 'Уровень ' + state.location.level + '+');
    setText('locationDesc', state.location.desc);
    renderCombat(state.combat);
    renderSkills(p, state.combat);
    renderExits(state.exits || []);
    renderMap(state.map, state.exits || []);
    renderEquipment(p);
    renderInventory(p);
    renderQuest(p, state.questOffer);
    renderShop(state.shop || [], p);
    renderNearby(state.nearby || []);
    $('restBtn').textContent = state.location.town ? 'Отдых в таверне' : 'Отдых';
    $('restBtn').disabled = !state.location.town;
    $('searchBtn').disabled = Boolean(state.combat);
    $('attackBtn').disabled = !state.combat || p.cooldown > 0 || p.hp <= 0;
    $('attackBtn').textContent = p.cooldown > 0 ? 'Атаковать · ' + p.cooldown : 'Атаковать';
    $('fleeBtn').disabled = !state.combat || p.cooldown > 0 || p.hp <= 0;
    $('fleeBtn').textContent = 'Сбежать';
  }

  function renderCombat(enemy) {
    const box = $('combatBox');
    if (!enemy || enemy.hp <= 0) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    setText('enemyName', enemy.name);
    setText('enemyLevel', 'Уровень ' + enemy.level);
    setText('enemyHpText', enemy.hp + ' / ' + enemy.maxHp + ' HP');
    setMeter('enemyHpBar', enemy.hp, enemy.maxHp);
  }

  function renderSkills(player, enemy) {
    const list = $('skillsList');
    list.replaceChildren();
    if (!(player.skills || []).length) {
      const note = document.createElement('span');
      note.className = 'empty-note';
      note.textContent = 'Нет доступных навыков.';
      list.appendChild(note);
      return;
    }
    player.skills.forEach(skill => {
      const cd = Number(skill.cooldownLeft || 0);
      const needsEnemy = !['mana', 'guard', 'evade'].includes(skill.effect);
      const disabled = cd > 0 || player.mp < skill.cost || player.cooldown > 0 || (needsEnemy && !enemy) || player.hp <= 0;
      const label = skill.name + ' · ' + skill.cost + ' MP' + (cd > 0 ? ' · ' + cd : '');
      const button = makeButton(label, 'button skill-button', () => sendCommand('skill', { id: skill.id }), disabled, skill.text);
      list.appendChild(button);
    });
  }

  function renderExits(exits) {
    const list = $('exitsList');
    list.replaceChildren();
    exits.forEach(exit => {
      const label = exit.name + (exit.visited ? ' ·' : ' ?');
      const button = makeButton(label, 'button exit-button-item' + (exit.visited ? ' visited-exit' : ''), () => sendCommand('move', { to: exit.id }), Boolean(currentState && currentState.combat), 'Перейти: ' + exit.name + ', рекомендуемый уровень ' + exit.level);
      list.appendChild(button);
    });
  }

  function svgElement(tag, attributes, text) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes || {}).forEach(key => el.setAttribute(key, String(attributes[key])));
    if (text != null) el.textContent = String(text);
    return el;
  }

  function mapShortName(name) {
    const replacements = {
      'Поселение': 'Посел.', 'Перекрёсток': 'Перекр.', 'Берег реки': 'Река', 'Старая дорога': 'Старая дор.',
      'Глубокий лес': 'Лес', 'Лагерь охотников': 'Охотники', 'Каменоломня': 'Карьер', 'Заброшенная шахта': 'Шахта',
      'Старые руины': 'Руины', 'Горный проход': 'Перевал', 'Лагерь разбойников': 'Разбойн.', 'Каменная пещера': 'Пещера',
      'Старинные ворота': 'Ворота', 'Северная стоянка': 'Север'
    };
    return replacements[name] || name;
  }

  function renderMap(map, exits) {
    const svg = $('worldMap');
    svg.replaceChildren();
    if (!map || !Array.isArray(map.nodes)) return;
    const nodes = new Map(map.nodes.map(node => [node.id, node]));
    const currentExits = new Set(exits.map(exit => exit.id));
    (map.edges || []).forEach(edge => {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) return;
      const hidden = from.adjacent || to.adjacent;
      svg.appendChild(svgElement('line', {
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        class: 'map-edge' + (hidden ? ' hidden-edge' : '')
      }));
    });
    map.nodes.forEach(node => {
      const canMove = currentExits.has(node.id) && !node.current;
      const group = svgElement('g', {
        class: 'map-node' + (node.current ? ' current' : node.visited ? ' visited' : ' adjacent'),
        transform: 'translate(' + node.x + ' ' + node.y + ')',
        'data-loc': canMove ? node.id : '',
        tabindex: canMove ? '0' : '-1',
        role: canMove ? 'button' : 'img',
        'aria-label': node.visited ? node.name : 'Неизвестная локация'
      });
      group.appendChild(svgElement('title', {}, node.visited ? node.name : 'Неизвестная локация'));
      group.appendChild(svgElement('circle', { cx: 0, cy: 0, r: node.current ? 2.5 : 2.0 }));
      const text = node.visited ? mapShortName(node.name) : '?';
      group.appendChild(svgElement('text', { x: 0, y: -3.1 }, text));
      if (canMove) {
        group.addEventListener('click', () => sendCommand('move', { to: node.id }));
        group.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            sendCommand('move', { to: node.id });
          }
        });
      }
      svg.appendChild(group);
    });
  }

  function itemDescription(item) {
    if (item.type === 'weapon') return 'Атака +' + item.atk + ' · темп ' + (item.speed || 2);
    if (item.type === 'armor') return 'Защита +' + item.def;
    if (item.type === 'consumable') return 'В запасе: ' + item.qty;
    if (item.type === 'material') return 'Количество: ' + item.qty;
    return item.description || '';
  }

  function renderEquipment(player) {
    const list = $('equipmentList');
    list.replaceChildren();
    const equipment = player.equipment || {};
    [ ['weapon', 'Оружие'], ['armor', 'Броня'] ].forEach(([slot, label]) => {
      const row = document.createElement('div');
      row.className = 'equipment-row';
      const main = document.createElement('div');
      main.className = 'equipment-main';
      const slotLabel = document.createElement('span');
      slotLabel.className = 'equipment-label';
      slotLabel.textContent = label;
      const name = document.createElement('div');
      name.className = 'equipment-name';
      const detail = document.createElement('div');
      detail.className = 'equipment-detail';
      const item = equipment[slot];
      name.textContent = item ? item.name : 'Пусто';
      detail.textContent = item ? itemDescription(item) : 'Нет предмета';
      main.append(slotLabel, name, detail);
      row.appendChild(main);
      if (item) {
        const cost = 35 + (Number(item.bonus || 0) * 25);
        const up = makeButton('Улучшить', 'button item-action', () => sendCommand('upgrade', { slotType: slot }), false, '2 руды и ' + cost + ' золота; шанс зависит от бонуса и тира.');
        row.appendChild(up);
      }
      list.appendChild(row);
    });
  }

  function renderInventory(player) {
    const list = $('inventoryList');
    list.replaceChildren();
    const inventory = player.inventory || [];
    setText('inventoryCount', inventory.length + ' предметов');
    if (!inventory.length) {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = 'Инвентарь пуст.';
      list.appendChild(note);
      return;
    }
    inventory.forEach((item, slot) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      const main = document.createElement('div');
      main.className = 'item-main';
      const name = document.createElement('div');
      name.className = 'item-name';
      name.textContent = item.name + (item.qty > 1 ? ' ×' + item.qty : '');
      const detail = document.createElement('div');
      detail.className = 'item-description';
      detail.textContent = itemDescription(item);
      main.append(name, detail);
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      if (item.type === 'consumable') actions.appendChild(makeButton('Использовать', 'button item-action', () => sendCommand('use', { slot }), false));
      if (item.type === 'weapon' || item.type === 'armor') {
        actions.appendChild(makeButton('Надеть', 'button item-action', () => sendCommand('equip', { slot }), false));
        if (currentState && (currentState.location.id === 'settlement' || currentState.location.id === 'quarry')) {
          actions.appendChild(makeButton('Улучшить', 'button item-action', () => sendCommand('upgrade', { slot }), false));
        }
      }
      if (currentState && currentState.location.id === 'settlement') actions.appendChild(makeButton('Продать', 'button item-action', () => sendCommand('sell', { slot }), false));
      row.append(main, actions);
      list.appendChild(row);
    });
  }

  function renderQuest(player, offer) {
    const questText = $('questText');
    const button = $('questBtn');
    if (player.quest) {
      questText.textContent = player.quest.name + ': победить врагов, ' + player.quest.progress + '/' + player.quest.count + '. Награда: ' + player.quest.rewardGold + ' золота и ' + player.quest.rewardXp + ' опыта.';
      button.textContent = 'Проверить задание';
      button.disabled = false;
    } else if (offer) {
      questText.textContent = offer.name + ': победить ' + offer.count + ' врагов. Награда: ' + offer.rewardGold + ' золота и ' + offer.rewardXp + ' опыта.';
      button.textContent = 'Взять задание';
      button.disabled = false;
    } else {
      questText.textContent = 'Заданий пока нет.';
      button.textContent = 'Взять задание';
      button.disabled = false;
    }
  }

  function renderShop(shop, player) {
    const list = $('shopList');
    list.replaceChildren();
    shop.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';
      const main = document.createElement('div');
      main.className = 'item-main';
      const name = document.createElement('div');
      name.className = 'item-name';
      name.textContent = item.name;
      const desc = document.createElement('div');
      desc.className = 'item-description';
      desc.textContent = item.description;
      const price = document.createElement('div');
      price.className = 'shop-price';
      price.textContent = item.price + ' золота';
      main.append(name, desc, price);
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const button = makeButton('Купить', 'button item-action', () => sendCommand('buy', { id: item.id }), !currentState || currentState.location.id !== 'settlement' || player.gold < item.price);
      actions.appendChild(button);
      row.append(main, actions);
      list.appendChild(row);
    });
  }

  function renderNearby(nearby) {
    const list = $('nearbyList');
    list.replaceChildren();
    setText('nearbyCount', nearby.length + ' игроков');
    if (!nearby.length) {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = 'В этой локации пока никого нет.';
      list.appendChild(note);
      return;
    }
    nearby.forEach(player => {
      const row = document.createElement('div');
      row.className = 'nearby-person';
      const strong = document.createElement('strong');
      strong.textContent = player.name;
      row.append(strong, document.createTextNode(' · ' + player.cls + ' · ур. ' + player.level));
      list.appendChild(row);
    });
  }

  $('singleBtn').addEventListener('click', startSinglePlayer);
  $('multiBtn').addEventListener('click', startMultiplayer);
  $('checkServerBtn').addEventListener('click', () => { probeServer(); });
  serverUrlInput.addEventListener('change', () => {
    const base = getServerBase();
    if (base) safeStorageSet(SERVER_KEY, base);
  });
  $('attackBtn').addEventListener('click', () => sendCommand('attack'));
  $('searchBtn').addEventListener('click', () => sendCommand('search'));
  $('fleeBtn').addEventListener('click', () => sendCommand('flee'));
  $('restBtn').addEventListener('click', () => sendCommand('rest'));
  $('questBtn').addEventListener('click', () => sendCommand('quest'));
  $('chatForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('chatInput');
    const text = String(input.value || '').replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 180);
    if (!text) return;
    sendCommand('chat', { m: text });
    input.value = '';
    input.focus();
  });
  $('exitBtn').addEventListener('click', () => {
    saveLocalProgress();
    if (mode === 'single' && engine && localPeer) engine.handle({ t: 'cmd', c: 'save', a: {} }, localPeer, receiveMessage);
    cleanUpSession();
    mode = 'menu';
    currentState = null;
    showMenu();
  });
  window.addEventListener('beforeunload', () => {
    saveLocalProgress();
    if (mode === 'online' && socket && socket.readyState === WebSocket.OPEN) {
      try { socket.send(JSON.stringify({ t: 'cmd', c: 'save', a: {} })); } catch (_) { /* Browser is closing. */ }
    }
  });

  const queryServer = new URLSearchParams(window.location.search).get('server');
  const storedServer = safeStorageGet(SERVER_KEY);
  if (queryServer) serverUrlInput.value = queryServer;
  else if (storedServer) serverUrlInput.value = storedServer;
  else if (['localhost', '127.0.0.1'].includes(window.location.hostname)) serverUrlInput.value = 'ws://localhost:3000';
  if (getServerBase()) {
    const base = getServerBase();
    safeStorageSet(SERVER_KEY, base);
    probeServer();
  } else {
    updateServerPill('unknown', 'Не проверен');
    serverCheckText.textContent = 'Укажите адрес, чтобы проверить доступность мультиплеера.';
  }
})();
