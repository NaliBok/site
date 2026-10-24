(function () {
  'use strict';
  const E = window.GameEngine;
  if (!E) { console.error('GameEngine was not loaded.'); return; }
  const $ = (id) => document.getElementById(id);
  const DEFAULT_SERVER = 'https://nbwsb.onrender.com';
  const LOCAL_SAVE_KEY = 'strategy-web-save-v1';
  const SERVER_KEY = 'strategy-web-server-url';
  const STYLE_KEY = 'strategy-web-map-style';
  const ROOM_KEY = 'strategy-web-room-session';
  const state = {
    game: null, mode: 'bots', mapStyle: localStorage.getItem(STYLE_KEY) || 'pixel', selected: null,
    targetMode: null, localPlayerId: 1, serverUrl: normalizeServer(localStorage.getItem(SERVER_KEY) || DEFAULT_SERVER),
    roomCode: null, playerId: null, playerToken: null, roomHost: false, room: null, roomTimer: null, pingTimer: null,
    zoom: 34, lastRender: 0, busy: false, modalKind: null, gameMode: 'DOMINATION', previousRoomSync: null, spectating: false, roomListTimer: null
  };
  const tribesById = Object.fromEntries(E.TRIBES.map(t => [t.id,t]));
  const terrainSymbol = {UNKNOWN:'?',OCEAN:'~',WATER:'≈',PLAIN:'·',FOREST:'♣',MOUNTAIN:'▲'};
  const resourceSymbol = {FRUIT:'f',ANIMAL:'a',FISH:'o',ORE:'v',CROP:'c',WHALE:'w',RUINS:'*'};
  const unitGlyph = {WARRIOR:'W',RIDER:'R',ARCHER:'A',DEFENDER:'D',SWORDSMAN:'S',KNIGHT:'K',CATAPULT:'C',MIND_BENDER:'M',GIANT:'G',CLOAK:'X',DAGGER:'d',RAFT:'Rf',SCOUT_SHIP:'Sc',RAMMER:'Ra',BOMBER:'B',JUGGERNAUT:'Jg'};
  const buildingShort = {FARM:'F',MINE:'M',HUT:'H',PORT:'P',MOUNTAIN_TEMPLE:'T',FOREST_TEMPLE:'T',WATER_TEMPLE:'T',EMBASSY:'E',SAWMILL:'S',FORGE:'F',CUSTOM_HOUSE:'$',ROAD:'R'};
  const modeLabels = {bots:'Против ботов',local:'Одно устройство',online:'Онлайн'};
  const tribeSelect = $('tribe-select');
  E.TRIBES.forEach((tribe) => {
    const opt = document.createElement('option'); opt.value = tribe.id; opt.textContent = tribe.name; tribeSelect.appendChild(opt);
  });
  tribeSelect.value = 'IMPERIUS';
  const bannedSelect = $('banned-tribes');
  E.TRIBES.forEach(t => { const opt=document.createElement('option'); opt.value=t.id; opt.textContent=t.name; bannedSelect.appendChild(opt); });

  function normalizeServer(raw) {
    let url = String(raw || DEFAULT_SERVER).trim();
    if (!url) url = DEFAULT_SERVER;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try { const parsed = new URL(url); return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/,'')}`.replace(/\/$/,''); }
    catch (_) { return DEFAULT_SERVER; }
  }
  function apiUrl(path) { return `${state.serverUrl}${path.startsWith('/')?'':'/'}${path}`; }
  async function api(path, options) {
    const config = Object.assign({method:'GET',headers:{}}, options || {});
    config.headers = Object.assign({'Accept':'application/json'}, config.headers || {});
    if (config.body && typeof config.body !== 'string') { config.headers['Content-Type'] = 'application/json'; config.body = JSON.stringify(config.body); }
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8500); config.signal = controller.signal;
    try {
      const response = await fetch(apiUrl(path), config);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Ошибка сервера (${response.status})`);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Сервер долго не отвечает. Render может запускаться после простоя.');
      if (err instanceof TypeError) throw new Error('Не удалось подключиться. Проверьте адрес сервера и доступность Render.');
      throw err;
    } finally { clearTimeout(timeout); }
  }
  function setConnection(kind, label) {
    const el = $('connection-pill'); el.classList.remove('online','error'); if(kind) el.classList.add(kind);
    $('connection-label').textContent = label;
  }
  function pingServer() {
    if (state.pingTimer) clearTimeout(state.pingTimer);
    const el = $('server-ping'); if (el) { el.className='ping-state'; el.textContent='Проверка…'; }
    const started = performance.now();
    api('/api/status').then(data => {
      const ms = Math.round(performance.now()-started);
      if (el) { el.className='ping-state ok'; el.textContent=`Онлайн · ${ms} мс`; }
      setConnection('online', state.mode==='online' ? `Сервер · ${ms} мс` : 'Сервер доступен');
      if(data.version && $('server-address-label')) $('server-address-label').title = `Версия сервера ${data.version}`;
    }).catch(err => {
      if (el) { el.className='ping-state bad'; el.textContent='Нет связи'; }
      if(state.mode==='online') setConnection('error','Нет связи с сервером');
    }).finally(() => { state.pingTimer = setTimeout(pingServer, 20000); });
  }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(btn => { const active=btn.dataset.mode===mode; btn.classList.toggle('active',active); btn.setAttribute('aria-selected',String(active)); });
    $('opponents-field').classList.toggle('hidden', mode!=='bots');
    $('bot-style-field').classList.toggle('hidden', mode!=='bots');
    $('bot-difficulty-field').classList.toggle('hidden', mode!=='bots');
    $('local-count-field').classList.toggle('hidden', mode!=='local');
    $('local-bot-count-field').classList.toggle('hidden', mode!=='local');
    $('online-settings').classList.toggle('hidden',mode!=='online');
    $('room-lobby').classList.toggle('hidden',mode!=='online');
    if(mode==='online'&&!state.roomCode) { $('room-lobby').querySelector('.room-code-wrap').classList.add('hidden'); $('room-players').innerHTML=''; $('room-admin-actions').classList.add('hidden'); $('start-online').classList.add('hidden'); $('join-room').classList.remove('hidden'); $('join-code-field').classList.add('hidden'); $('join-room').textContent='Войти по коду'; }
    $('start-game').textContent=mode==='online'?'Создать комнату':'Начать партию';
    $('start-game').classList.toggle('hidden',mode==='online'&&!!state.roomCode);
    $('mode-note').textContent = mode==='bots' ? 'Локальное сохранение' : mode==='local' ? 'Ходы передаются по очереди' : 'Подключение к Render';
    if(mode==='online') { setConnection('', 'Подключение'); pingServer(); refreshPublicRooms(); }
    else { stopRoomListPolling(); setConnection('', 'Локальный режим'); }
    $('setup-error').textContent='';
  }
  function showToast(message) {
    const el=$('toast'); el.textContent=message; el.classList.add('show');
    if(state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
  }
  function showError(message) { $('setup-error').textContent=message || ''; }
  function setGameScreens(inGame) { $('setup-screen').classList.toggle('hidden',inGame); $('game-screen').classList.toggle('hidden',!inGame); }
  function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function activePlayer() { return state.game ? E.playerById(state.game,state.mode==='online' ? state.playerId : state.game.activePlayer) : null; }
  function currentTurnPlayer() { return state.game ? E.playerById(state.game,state.game.activePlayer) : null; }
  function isMyTurn() {
    if(!state.game || state.spectating) return false;
    if(state.mode==='online') return Number(state.game.activePlayer)===Number(state.playerId) && !state.game.over;
    return !currentTurnPlayer()?.isAI && !state.game.over;
  }
  function currentViewingPlayerId() { return state.spectating ? Number(state.game?.activePlayer||1) : state.mode==='online' ? Number(state.playerId) : Number(state.game?.activePlayer||1); }
  function viewGame() {
    if(!state.game) return null;
    if(state.spectating) return state.game;
    const id=currentViewingPlayerId();
    try { return E.getPlayerView(state.game,id); } catch (_) { return state.game; }
  }
  function localHumanCount() { return Number($('local-count').value||2); }
  function selectedBans() { return [...$('banned-tribes').selectedOptions].map(o=>o.value); }
  function availableTribes(primary) { return E.TRIBES.filter(t=>t.id===primary||!selectedBans().includes(t.id)); }
  function customWorldRows() {
    if ($('map-type').value !== 'CUSTOM') return null;
    const raw=$('custom-world').value.trim();
    if(!raw) throw new Error('Введите карту в формате строк ASCII или загрузите файл.');
    let rows;
    try {
      const parsed=JSON.parse(raw);
      rows=Array.isArray(parsed)?parsed:(Array.isArray(parsed.grid)?parsed.grid:parsed.rows);
      if(Array.isArray(rows)&&rows.length&&Array.isArray(rows[0])) rows=rows.map(row=>row.map(v=>{const raw=String(v&&typeof v==='object'?(v.terrain||v.type||'PLAIN'):v).toUpperCase();return ({OCEAN:'~',WATER:'w',PLAIN:'.',FOREST:'T',MOUNTAIN:'^','~':'~','W':'w','.':'.','T':'T','^':'^'}[raw]||'.');}).join(''));
    } catch(_) { rows=raw.split(/\r?\n/).map(x=>x.replace(/\s+$/,'')).filter(Boolean); }
    if(!Array.isArray(rows)||rows.length<7||rows.length>60||!rows.every(r=>typeof r==='string'&&r.length===rows.length)) throw new Error('Свой мир должен быть квадратом от 7×7 до 60×60.');
    if(rows.some(r=>/[^~w.T^ ]/.test(r))) throw new Error('В карте допустимы только символы ~ w . T ^.');
    return rows;
  }
  function getRequestedMapSize() {
    const selected=$('map-size').value;
    const n=selected==='custom'?Number($('custom-map-size').value):Number(selected);
    if(!Number.isInteger(n)||n<7||n>60) throw new Error('Размер карты должен быть от 7 до 60.');
    return n;
  }
  function configPlayers() {
    const name=($('player-name').value.trim()||'Игрок 1').slice(0,22); const tribe=$('tribe-select').value;
    const bans=selectedBans();
    if(bans.includes(tribe)) throw new Error('Ваше племя выбрано в списке запретов.');
    const available=E.TRIBES.filter(t=>!bans.includes(t.id));
    if(available.length < 2) throw new Error('Для игры оставьте не менее двух доступных племён.');
    const configs=[{name,tribe,isAI:false}];
    const used=new Set([tribe]);
    function chooseTribe(preferredIndex) {
      for(let j=0;j<E.TRIBES.length;j++) { const t=E.TRIBES[(preferredIndex+j)%E.TRIBES.length]; if(!bans.includes(t.id)&&!used.has(t.id)) {used.add(t.id);return t.id;} }
      return available.find(t=>!used.has(t.id))?.id || available[0].id;
    }
    if(state.mode==='bots') {
      const count=Number($('bot-count').value||3);
      for(let i=0;i<count&&configs.length<8;i++) configs.push({name:`Бот ${i+2}`,tribe:chooseTribe((E.TRIBES.findIndex(x=>x.id===tribe)+1+i)%E.TRIBES.length),isAI:true,aiType:$('bot-style').value,difficulty:$('bot-difficulty').value});
    } else if(state.mode==='local') {
      const humans=localHumanCount(), bots=Number($('local-bot-count').value||0);
      for(let i=1;i<humans&&configs.length<8;i++) configs.push({name:`Игрок ${i+1}`,tribe:chooseTribe((E.TRIBES.findIndex(x=>x.id===tribe)+i)%E.TRIBES.length),isAI:false});
      for(let i=0;i<bots&&configs.length<8;i++) configs.push({name:`Бот ${configs.length+1}`,tribe:chooseTribe((E.TRIBES.findIndex(x=>x.id===tribe)+humans+i)%E.TRIBES.length),isAI:true,aiType:'BALANCED',difficulty:'NORMAL'});
    }
    return configs;
  }
  function startLocalGame() {
    try {
      stopRoomPolling(); stopSpectatorPolling(); state.roomCode=null; state.playerId=null; state.room=null; state.spectating=false;
      const players=configPlayers(); const customWorld=customWorldRows(); const mapSize=customWorld?customWorld.length:getRequestedMapSize();
      const seed=Number($('world-seed').value)||undefined;
      state.game=E.createGame({name:$('player-name').value.trim()||'Игрок 1',tribe:$('tribe-select').value,mapSize,players,gameMode:$('victory-mode').value,mapType:$('map-type').value,customWorld,seed});
      state.selected=null; state.targetMode=null;
      try { localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify({game:state.game,mode:state.mode,savedAt:Date.now()})); } catch(_) {}
      showGame(); if(state.mode==='bots') runAIs();
    } catch(err) { showError(err.message); }
  }
  function saveLocalGame() {
    if(!state.game||state.mode==='online'||state.spectating) { showToast('Онлайн-партия хранится на сервере.'); return; }
    try { localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify({game:state.game,mode:state.mode,savedAt:Date.now()})); showToast('Партия сохранена в этом браузере.'); }
    catch (_) { showToast('Браузер не разрешил сохранить партию.'); }
  }
  function tryLoadSave() {
    try {
      const raw=localStorage.getItem(LOCAL_SAVE_KEY); if(!raw) return;
      const saved=JSON.parse(raw); if(!saved || !saved.game || !saved.game.grid) return;
      const btn=document.createElement('button'); btn.id='continue-game'; btn.type='button'; btn.className='secondary-button'; btn.textContent='Продолжить сохранённую';
      btn.addEventListener('click',()=>{
        state.game=saved.game; state.mode=saved.mode==='local'?'local':'bots'; setMode(state.mode); state.selected=null; state.targetMode=null; showGame(); if(state.mode==='bots') runAIs();
      });
      $('start-game').insertAdjacentElement('beforebegin',btn); $('mode-note').textContent='Найдено сохранение в этом браузере';
    } catch (_) {}
  }
  function showGame() {
    setGameScreens(true); renderAll();
    $('game-heading').textContent='';
    $('map-dimension').textContent=`${state.game.mapSize} × ${state.game.mapSize}`;
    document.querySelectorAll('.style-button').forEach(b=>b.classList.toggle('active',b.dataset.style===state.mapStyle));
    $('game-map').classList.remove('view-ascii','view-pixel','view-vector'); $('game-map').classList.add(`view-${state.mapStyle}`);
  }
  function saveRoomSession() {
    try { if(state.roomCode&&state.playerId&&state.playerToken) localStorage.setItem(ROOM_KEY,JSON.stringify({url:state.serverUrl,code:state.roomCode,playerId:state.playerId,playerToken:state.playerToken,host:state.roomHost})); } catch(_) {}
  }
  async function createOnlineRoom() {
    showError('');
    try {
      if(selectedBans().includes($('tribe-select').value)) throw new Error('Ваше племя выбрано в списке запретов.');
      const customWorld=customWorldRows(); const mapSize=customWorld?customWorld.length:getRequestedMapSize();
      const options={name:$('player-name').value.trim()||'Игрок 1',tribe:$('tribe-select').value,mapSize,mapType:$('map-type').value,customWorld,seed:Number($('world-seed').value)||undefined,gameMode:$('victory-mode').value,maxPlayers:Number($('room-max-players').value),roomName:$('room-name').value.trim()||'Новая партия',privacy:$('room-privacy').value,spectators:$('room-spectators').value==='yes',spectatorDelay:Number($('room-spectator-delay').value),replacePolicy:$('room-replace-policy').value,allowPause:$('room-allow-pause').value==='yes',timeLimitSeconds:Number($('room-turn-time').value)||0,bannedTribes:selectedBans()};
      const data=await api('/api/rooms',{method:'POST',body:options});
      state.roomCode=data.code; state.playerId=data.playerId; state.playerToken=data.playerToken; state.roomHost=true; state.room=data.room||null; state.game=null; state.spectating=false; saveRoomSession();
      $('room-lobby').classList.remove('hidden'); $('room-code').textContent=data.code; $('start-game').classList.add('hidden');
      $('room-admin-actions').classList.remove('hidden'); setConnection('online','Комната создана'); renderLobby(data.room); pollRoom(); refreshPublicRooms();
    } catch(err) { showError(err.message); $('server-ping').textContent='Ошибка соединения'; $('server-ping').className='ping-state bad'; }
  }
  async function joinOnlineRoom(forcedCode) {
    const code=String(forcedCode||$('join-code').value).trim().toUpperCase().replace(/[^A-Z0-9]/g,''); if(code.length<4) { showError('Введите код комнаты.'); return; }
    showError('');
    try {
      const data=await api(`/api/rooms/${encodeURIComponent(code)}/join`,{method:'POST',body:{name:$('player-name').value.trim()||'Игрок',tribe:$('tribe-select').value}});
      state.roomCode=data.code; state.playerId=data.playerId; state.playerToken=data.playerToken; state.roomHost=false; state.room=data.room||null; saveRoomSession();
      $('room-code').textContent=data.code; $('room-lobby').classList.remove('hidden'); $('room-lobby').querySelector('.room-code-wrap').classList.remove('hidden'); $('join-code-field').classList.add('hidden'); $('join-room').textContent='Войти по коду'; $('start-game').classList.add('hidden');
      setConnection('online','В комнате'); renderLobby(data.room); pollRoom(); showToast('Вы присоединились к комнате.');
    } catch(err) { showError(err.message); }
  }
  async function startOnlineRoom() {
    if(!state.roomCode) return;
    try {
      const data=await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/start`,{method:'POST',body:{playerId:state.playerId,playerToken:state.playerToken}});
      if(data.state) { state.game=data.state; }
      if(data.room) state.room=data.room;
      renderLobby(state.room); await pollRoom(); showToast('Матч начался.');
    } catch(err) { showError(err.message); }
  }
  function renderLobby(room) {
    if(!room) return;
    state.room=room;
    $('room-lobby').classList.remove('hidden'); $('room-lobby').querySelector('.room-code-wrap').classList.remove('hidden'); $('room-code').textContent=room.code||state.roomCode||'------';
    const players=room.players||[];
    $('room-players').innerHTML=players.map(p=>`<span class="room-player-chip">${escapeHtml(p.name)}${p.isHost?' · хост':''}${p.isAI?' · бот':''}${p.connected===false?' · нет связи':''}</span>`).join('') + (room.paused?'<span class="room-player-chip">Пауза</span>':'') + (room.started?'<span class="room-player-chip">Идёт матч</span>':'');
    $('start-online').disabled=!state.roomHost||players.length<2||room.started||room.paused;
    $('start-online').textContent=room.started?'Матч начат':players.length<2?'Ожидание игроков':'Начать матч';
    $('start-online').classList.toggle('hidden',!state.roomHost);
    $('join-room').classList.toggle('hidden',state.roomHost);
    $('room-admin-actions').classList.toggle('hidden',!state.roomHost);
    $('pause-room').classList.toggle('hidden',!room.started||room.paused||!room.allowPause);
    $('resume-room').classList.toggle('hidden',!room.paused||!state.roomHost);
    if(room.started) {
      const eligible=players.filter(p=>!p.isHost);
      $('replace-player-id').innerHTML=eligible.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      $('replace-player').disabled=!eligible.length;
    }
    if(room.started && room.state) { state.game=room.state; showGame(); }
  }
  async function pollRoom() {
    if(!state.roomCode||!state.playerId) return;
    try {
      const data=await api(`/api/rooms/${encodeURIComponent(state.roomCode)}?playerId=${encodeURIComponent(state.playerId)}&playerToken=${encodeURIComponent(state.playerToken||'')}`);
      state.room=data.room; renderLobby(data.room);
      if(data.state) {
        const wasStarted=!!state.game; state.game=data.state;
        if(!$('game-screen').classList.contains('hidden')) renderAll();
        else if(data.room?.started) showGame();
        if(state.game?.over) showGame();
      }
      if(data.room?.closed) { stopRoomPolling(); showError('Комната закрыта.'); }
    } catch(err) {
      if(err.message.includes('не найдена')||err.message.includes('закрыта')) { stopRoomPolling(); showError(err.message); }
      else if(state.mode==='online') setConnection('error','Нет связи');
    } finally { if(state.roomCode) state.roomTimer=setTimeout(pollRoom,1700); }
  }
  function stopRoomPolling() { if(state.roomTimer) clearTimeout(state.roomTimer); state.roomTimer=null; }
  async function refreshPublicRooms() {
    if(state.mode!=='online') return;
    try {
      const data=await api('/api/rooms'); const list=$('public-room-list');
      const rooms=data.rooms||[];
      list.innerHTML=rooms.length?rooms.map(r=>`<div class="public-room-item"><div><strong>${escapeHtml(r.roomName||'Новая партия')}</strong><small>${escapeHtml(r.code)} · ${r.mapSize}×${r.mapSize} · ${(r.players||[]).length}/${r.maxPlayers} · ${r.paused?'пауза':r.started?'идёт':'ожидание'}${r.timeLimitSeconds?` · ${r.timeLimitSeconds}с`:''}</small></div><div class="public-room-actions">${!r.started&&!r.finished?`<button type="button" data-join-public="${escapeHtml(r.code)}">Войти</button>`:''}${r.started&&r.spectators?`<button type="button" data-watch-public="${escapeHtml(r.code)}">Наблюдать</button>`:''}</div></div>`).join(''):'<div class="muted-label">Открытых публичных комнат нет.</div>';
      list.querySelectorAll('[data-join-public]').forEach(btn=>btn.addEventListener('click',()=>joinOnlineRoom(btn.dataset.joinPublic)));
      list.querySelectorAll('[data-watch-public]').forEach(btn=>btn.addEventListener('click',()=>watchRoom(btn.dataset.watchPublic)));
    } catch(err) { if(state.mode==='online') $('public-room-list').innerHTML='<div class="muted-label">Не удалось получить список комнат.</div>'; }
    finally { stopRoomListPolling(); if(state.mode==='online') state.roomListTimer=setTimeout(refreshPublicRooms,5000); }
  }
  function stopRoomListPolling() { if(state.roomListTimer) clearTimeout(state.roomListTimer); state.roomListTimer=null; }
  async function roomControl(action, extra={}) {
    if(!state.roomCode||!state.playerToken) return;
    try { const data=await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/${action}`,{method:'POST',body:{playerId:state.playerId,playerToken:state.playerToken,...extra}}); if(data.room) {state.room=data.room;renderLobby(data.room);} if(data.state) {state.game=data.state;renderAll();} refreshPublicRooms(); showToast('Готово.'); }
    catch(err) { showToast(err.message); }
  }
  async function watchRoom(code) {
    try {
      stopRoomPolling(); state.roomCode=code; state.playerId=null; state.playerToken=null; state.roomHost=false; state.spectating=true; state.mode='spectator';
      const data=await api(`/api/rooms/${encodeURIComponent(code)}/spectate`); state.room=data.room; state.game=data.state;
      if(!state.game) throw new Error('В комнате пока нет доступного снимка матча.');
      setGameScreens(true); showGame(); pollSpectator();
    } catch(err) { state.spectating=false; showError(err.message); }
  }
  async function pollSpectator() {
    if(!state.spectating||!state.roomCode) return;
    try { const data=await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/spectate`); if(data.state) {state.game=data.state; if(!$('game-screen').classList.contains('hidden')) renderAll();} }
    catch(err) { showToast(err.message); stopSpectatorPolling(); }
    finally { if(state.spectating) state.roomTimer=setTimeout(pollSpectator,3000); }
  }
  function stopSpectatorPolling() { if(state.spectating&&state.roomTimer) clearTimeout(state.roomTimer); state.roomTimer=null; state.spectating=false; }
  async function sendOnlineAction(action) {
    if(!state.roomCode||!state.playerId) throw new Error('Сессия комнаты не найдена.');
    const data=await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/action`,{method:'POST',body:{playerId:state.playerId,playerToken:state.playerToken,action}});
    if(data.state) state.game=data.state;
    if(data.room) state.room=data.room;
    if(data.state) renderAll();
    return state.game;
  }
  async function sendOnlineEndTurn() {
    const data=await api(`/api/rooms/${encodeURIComponent(state.roomCode)}/end-turn`,{method:'POST',body:{playerId:state.playerId,playerToken:state.playerToken}});
    if(data.state) state.game=data.state; if(data.room) state.room=data.room; renderAll();
  }
  async function dispatch(action) {
    if(!state.game) return;
    if(state.mode==='online') {
      if(!isMyTurn()) { showToast('Сейчас ход другого игрока.'); return; }
      try { await sendOnlineAction(action); state.selected=null; state.targetMode=null; renderAll(); }
      catch(err) { showToast(err.message); $('action-error').textContent=err.message; }
    } else {
      if(!isMyTurn()) { showToast('Сейчас ход другого игрока.'); return; }
      try {
        E.performAction(state.game,state.game.activePlayer,action);
        state.selected=null; state.targetMode=null; $('action-error').textContent='';
        saveQuietly(); renderAll();
      } catch(err) { $('action-error').textContent=err.message; showToast(err.message); }
    }
  }
  function saveQuietly() { if(!state.game||state.mode==='online'||state.spectating) return; try { localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify({game:state.game,mode:state.mode,savedAt:Date.now()})); } catch(_) {} }
  function renderAll() {
    if(!state.game) return;
    const game=state.game, viewingId=currentViewingPlayerId(), viewing=E.playerById(game,viewingId), turn=E.playerById(game,game.activePlayer), visibleGame=viewGame();
    if(!viewing) return;
    $('game-subtitle').textContent=`${game.mode==='online'?'ОНЛАЙН · ':''}ХОД ${game.turn}`;
    $('turn-badge').textContent=`ХОД ${game.turn}`;
    $('active-player-label').textContent=turn ? `Ход: ${turn.name}` : 'Ход завершён';
    $('turn-status').textContent=state.spectating?'Наблюдение':game.over?'Завершено':isMyTurn()?'Ваш ход':'Ожидание';
    $('end-turn').disabled=!isMyTurn()||state.busy||game.over;
    $('end-turn').textContent=state.spectating?'Наблюдение':'Завершить ход';
    $('save-game').disabled=state.spectating||state.mode==='online';
    $('end-turn').innerHTML=state.mode==='local'&&turn&&!turn.isAI&&turn.id!==1?'Передать ход <span aria-hidden="true">→</span>':'Завершить ход <span aria-hidden="true">→</span>';
    $('turn-tip').textContent=game.over ? (game.winner?`Победитель: ${E.playerById(game,game.winner)?.name||'—'}`:'Партия завершена.') : !isMyTurn() ? (state.spectating?'Наблюдение':state.mode==='online'?'Ждём действия активного игрока.':'Сейчас ход бота.') : state.mode==='local'&&turn.id!==1?`Передайте устройство игроку «${turn.name}».`:'Собирайте ресурсы, изучайте технологии и захватывайте нейтральные города.';
    renderPlayers(state.spectating?game:visibleGame,viewingId);
    renderMap(visibleGame,viewingId);
    renderSelection(visibleGame,viewingId);
    renderTech(game,viewingId);
    renderLog(game);
    renderEmpire(game,viewingId);
    if(game.over) showWinnerBanner(game);
    maybeOpenMonumentReward();
  }
  function renderPlayers(game, viewingId) {
    const html=game.players.map(p=>{
      const cities=E.citiesOf(game,p.id).length, units=E.unitsOf(game,p.id).length;
      const active=game.activePlayer===p.id;
      return `<div class="player-item ${active?'active':''}"><span class="player-color" style="background:${escapeHtml(p.color)}"></span><div><div class="player-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.id===viewingId?' · вы':''}</div><div class="player-tribe">${escapeHtml(p.tribeName||tribesById[p.tribe]?.name||p.tribe)}${p.isAI?' · бот':''}</div></div><span class="player-stars">${p.stars}★</span><div class="player-stats"><span>⌂ ${cities}</span><span>⚑ ${units}</span><span>${p.spt}★/х</span></div></div>`;
    }).join('');
    $('player-list').innerHTML=html;
  }
  function tileAccessibleToView(t, viewerId) { return !!t && t.terrain!=='UNKNOWN'; }
  function spritePath(type) { return state.mapStyle==='pixel' ? `assets/sprites/${type}-pixel.svg` : `assets/sprites/${type}.svg`; }
  function asciiToken(t, unknown) {
    if (unknown) return '??';
    if (t.unit) {
      const short={WARRIOR:'W',RIDER:'R',ARCHER:'A',DEFENDER:'D',SWORDSMAN:'S',KNIGHT:'K',CATAPULT:'C',MIND_BENDER:'M',GIANT:'G',CLOAK:'X',DAGGER:'d',RAFT:'r',SCOUT_SHIP:'s',RAMMER:'m',BOMBER:'b',JUGGERNAUT:'j'}[t.unit.type]||'?';
      return `${short}${t.unit.owner}`.slice(0,2);
    }
    if (t.city) return `C${t.city.owner||0}`;
    const base={OCEAN:'~',WATER:'w',PLAIN:'.',FOREST:'T',MOUNTAIN:'^'}[t.terrain]||'?';
    const second=t.resource?({FRUIT:'f',ANIMAL:'a',FISH:'o',ORE:'v',CROP:'c',WHALE:'w',RUINS:'*'}[t.resource]||'*'):
      t.building?({FARM:'F',MINE:'M',HUT:'H',PORT:'P',MOUNTAIN_TEMPLE:'T',FOREST_TEMPLE:'T',WATER_TEMPLE:'T',EMBASSY:'E',SAWMILL:'S',FORGE:'F',CUSTOM_HOUSE:'$',ROAD:'R'}[t.building.type]||'B'):t.hasRoad?'R':' ';
    return `${base}${second}`.slice(0,2);
  }
  function unitSprite(type) {
    return ({WARRIOR:'unit-warrior',RIDER:'unit-rider',ARCHER:'unit-archer',DEFENDER:'unit-defender',SWORDSMAN:'unit-swordsman',KNIGHT:'unit-knight',CATAPULT:'unit-catapult',MIND_BENDER:'unit-mind-bender',GIANT:'unit-giant',CLOAK:'unit-cloak',DAGGER:'unit-dagger',RAFT:'unit-raft',SCOUT_SHIP:'unit-scout-ship',RAMMER:'unit-rammer',BOMBER:'unit-bomber',JUGGERNAUT:'unit-juggernaut'})[type]||'unit-warrior';
  }
  function renderMap(game, viewerId) {
    const map=$('game-map'); map.classList.remove('view-ascii','view-pixel','view-vector'); map.classList.add(`view-${state.mapStyle}`);
    let found=0, explored=0, total=game.mapSize*game.mapSize;
    const selected=state.selected;
    const tileData=[];
    for(let y=0;y<game.mapSize;y++) for(let x=0;x<game.mapSize;x++) {
      const t=game.grid[y][x]; const real=state.game.grid[y][x];
      const isVisible=real.visibleTo&&real.visibleTo.includes(Number(viewerId)); const isExplored=real.exploredBy&&real.exploredBy.includes(Number(viewerId));
      if(isExplored) explored++; if(isVisible) found++;
      const unknown=t.terrain==='UNKNOWN';
      const classes=['map-tile',unknown?'fog':`terrain-${t.terrain.toLowerCase()}`,isVisible?'visible':isExplored?'explored-hidden':'fog',selected&&selected.x===x&&selected.y===y?'selected':'',t.city?'tile-city':'',t.hasRoad?'tile-road':'',t.building?'tile-building':''].filter(Boolean).join(' ');
      const title=unknown?`Неизведанная клетка ${x},${y}`:`${E.TERRAIN_INFO[t.terrain]?.label||t.terrain}${t.resource?`, ${E.RESOURCE_INFO[t.resource]?.label||t.resource}`:''}${t.city?', город':''}${t.unit?`, ${E.UNITS[t.unit.type]?.name||t.unit.type}`:''} · ${x},${y}`;
      tileData.push({x,y,t,unknown,isVisible,isExplored,classes,title});
    }
    if(state.mapStyle==='ascii') {
      map.style.removeProperty('--cell-size'); map.style.gridTemplateColumns='none';
      map.innerHTML=`<div class="ascii-board" style="grid-template-columns:repeat(${game.mapSize},4ch)">${tileData.map(d=>{
        const owner=d.t.unit?.owner||d.t.city?.owner; const ownerObj=owner?E.playerById(state.game,owner):null;
        const token=asciiToken(d.t,d.unknown).padEnd(2,' ');
        return `<button type="button" role="gridcell" class="ascii-cell ${d.classes}" data-x="${d.x}" data-y="${d.y}" aria-label="${escapeHtml(d.title)}" title="${escapeHtml(d.title)}"><span class="ascii-owner" style="${ownerObj?`color:${escapeHtml(ownerObj.color)}`:''}">[${escapeHtml(token)}]</span></button>`;
      }).join('')}</div>`;
    } else {
      const tileW=Math.max(48,Math.round(state.zoom*2.15)), tileH=Math.max(30,Math.round(state.zoom*1.32));
      const boardW=game.mapSize*tileW, boardH=game.mapSize*tileH;
      map.innerHTML=`<div class="iso-board" style="width:${boardW}px;height:${boardH}px;--iso-w:${tileW}px;--iso-h:${tileH}px">${tileData.map(d=>{
        const t=d.t, owner=t.unit?.owner||t.city?.owner; const ownerObj=owner?E.playerById(state.game,owner):null;
        const px=(d.x-d.y+game.mapSize-1)*tileW/2, py=(d.x+d.y)*tileH/2;
        const terrainName=d.unknown?'unknown':String(t.terrain).toLowerCase();
        let entity='';
        if(!d.unknown&&t.unit) entity=`<img class="iso-entity unit" src="${spritePath(unitSprite(t.unit.type))}" alt="" loading="lazy">`;
        else if(!d.unknown&&t.city) entity=`<img class="iso-entity structure" src="${spritePath(t.city.capital&&t.city.owner===viewerId?'building-capital':'building-city')}" alt="" loading="lazy">`;
        else if(!d.unknown&&t.building) entity=`<img class="iso-entity structure" src="${spritePath('building-'+({'FARM':'farm','MINE':'mine','HUT':'hut','PORT':'port','MOUNTAIN_TEMPLE':'mountain-temple','FOREST_TEMPLE':'forest-temple','WATER_TEMPLE':'water-temple','EMBASSY':'embassy','SAWMILL':'sawmill','FORGE':'forge','CUSTOM_HOUSE':'custom-house'}[t.building.type]||'city'))}" alt="" loading="lazy">`;
        let resource=''; if(!d.unknown&&t.resource&&!t.unit) resource=`<img class="iso-entity resource" src="${spritePath('resource-'+({FRUIT:'fruit',ANIMAL:'animal',FISH:'fish',ORE:'ore',CROP:'crop',WHALE:'whale',RUINS:'ruins'}[t.resource]||'fruit'))}" alt="" loading="lazy">`;
        return `<button type="button" role="gridcell" class="iso-tile ${d.classes}" style="left:${px}px;top:${py}px;--unit-color:${escapeHtml(ownerObj?.color||'#d7e3cc')};z-index:${d.x+d.y}" data-x="${d.x}" data-y="${d.y}" aria-label="${escapeHtml(d.title)}" title="${escapeHtml(d.title)}"><img class="iso-ground" src="${spritePath('terrain-'+terrainName)}" alt="" loading="lazy">${t.hasRoad&&!d.unknown?'<span class="road-marker"></span>':''}${resource}${entity}${ownerObj&&t.unit?'<span class="owner-dot"></span>':''}</button>`;
      }).join('')}</div>`;
      map.style.gridTemplateColumns='none'; map.style.setProperty('--cell-size',`${state.zoom}px`);
    }
    $('visible-count').textContent=state.spectating?`Ход ${game.turn}`:`Открыто ${Math.round(explored/total*100)}% карты`;
    $('map-coordinates').textContent=selected?`x: ${String(selected.x).padStart(2,'0')} · y: ${String(selected.y).padStart(2,'0')}`:'x: — · y: —';
    $('map-help').textContent=state.spectating?'Режим наблюдателя':state.targetMode==='move'?'Клетка назначения':state.targetMode==='attack'?'Цель атаки':state.targetMode==='special'?'Цель действия':isMyTurn()?'Выберите клетку':'Ход другого игрока';
  }
  function renderSelection(game, viewerId) {
    const s=state.selected; const root=$('selection-details'), actions=$('action-buttons'); $('action-error').textContent='';
    if(!s) { $('selected-coords').textContent='—'; root.innerHTML='<div class="empty-selection"><span class="empty-glyph">⌖</span><strong>Ничего не выбрано</strong><p>Нажмите на клетку карты, чтобы увидеть сведения и действия.</p></div>'; actions.innerHTML=''; return; }
    const t=E.tileAt(game,s.x,s.y); if(!t) { state.selected=null; root.innerHTML=''; actions.innerHTML=''; return; }
    $('selected-coords').textContent=`${String(s.x).padStart(2,'0')}, ${String(s.y).padStart(2,'0')}`;
    const unknown=t.terrain==='UNKNOWN'; const info=unknown?{label:'Неизведанная земля',glyph:'?'}:E.TERRAIN_INFO[t.terrain]||{label:t.terrain,glyph:'?'};
    const p=E.playerById(state.game,viewerId); const city=t.city; const unit=t.unit;
    let title=info.label, subtitle='Клетка карты', glyph=info.glyph;
    if(city) { title=city.owner===0?'Нейтральный город':`Город · ${E.playerById(state.game,city.owner)?.name||'игрока'}`; subtitle=`Уровень ${city.level}${city.capital?' · столица':''}`; glyph='⌂'; }
    if(unit) { title=E.UNITS[unit.type]?.name||unit.type; subtitle=`${unit.hp}/${unit.maxHp} HP · ${E.playerById(state.game,unit.owner)?.name||'игрок'}`; glyph=unitGlyph[unit.type]||'◈'; }
    const lines=[];
    if(!unknown&&t.resource) lines.push(['Ресурс',E.RESOURCE_INFO[t.resource]?.label||t.resource]);
    if(!unknown&&t.hasRoad) lines.push(['Дорога','Построена']);
    if(!unknown&&t.building) lines.push(['Сооружение',({FARM:'Ферма',MINE:'Шахта',HUT:'Лесная хижина',PORT:'Порт',MOUNTAIN_TEMPLE:'Горный храм',FOREST_TEMPLE:'Лесной храм',WATER_TEMPLE:'Водный храм',EMBASSY:'Посольство'})[t.building.type]||t.building.type]);
    if(city) { lines.push(['Население',`${city.population} / ${city.level+1}`]); lines.push(['Доход города',`${1+(city.bonusSpt||0)}★ / ход`]); if(city.hasWall) lines.push(['Защита','Стена ×4']); if(city.underSiegeBy) lines.push(['Статус','Осаждён']); }
    if(unit) { lines.push(['Атака',String(E.UNITS[unit.type]?.atk??'—')]); lines.push(['Защита',String(E.UNITS[unit.type]?.def??'—')]); lines.push(['Движение',String(E.UNITS[unit.type]?.move??'—')]); lines.push(['Статус',unit.movedThisTurn?'Уже двигался':'Готов к движению']); }
    if(!unknown&&!city&&!unit) lines.push(['Защита местности',String(E.TERRAIN_INFO[t.terrain]?.defense||1)]);
    root.innerHTML=`<div class="tile-info-title"><span class="tile-info-glyph">${escapeHtml(glyph)}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div></div><div class="info-lines">${lines.map(row=>`<div class="info-line"><span>${escapeHtml(row[0])}</span><strong>${escapeHtml(row[1])}</strong></div>`).join('')}</div>`;
    actions.innerHTML=''; if(!isMyTurn()||unknown||state.game.over) return;
    const add=(label,fn,primary)=>{const btn=document.createElement('button');btn.type='button';btn.className='action-button'+(primary?' primary':'');btn.textContent=label;btn.addEventListener('click',fn);actions.appendChild(btn);};
    if(unit&&unit.owner===viewerId) {
      if(!unit.movedThisTurn) add('Переместить',()=>armTarget('move'),true);
      if(!unit.attackedThisTurn) add('Атаковать цель',()=>armTarget('attack'),false);
      if(unit.type==='MIND_BENDER') add('Лечение / обращение',()=>armTarget('special'),false);
      if(unit.type==='CLOAK') add('Проникнуть в город',()=>armTarget('special'),false);
      if(E.UNITS[unit.type]?.domain==='naval') add('Высадиться',()=>armTarget('special'),false);
      if(t.building?.type==='PORT'&&E.UNITS[unit.type]?.domain!=='naval'&&E.hasTech(p,'SAILING')) add('Отправить на плот',()=>dispatch({type:'embark',x:s.x,y:s.y}),false);
    }
    const tileActions=E.getTileActions(state.game,viewerId,s.x,s.y);
    for(const action of tileActions) {
      if(['harvest'].includes(action.type)) add(action.label,()=>dispatch({type:action.type,x:s.x,y:s.y}),true);
      if(action.type==='train') add('Обучить отряд',()=>openTrainModal(s.x,s.y),false);
      if(action.type==='upgradeCity') add(action.label,()=>openCityUpgrade(s.x,s.y),true);
      if(action.type==='port') add(action.label,()=>dispatch({type:'build',building:'PORT',x:s.x,y:s.y}),false);
      if(action.type==='road') add(action.label,()=>dispatch({type:'build',building:'ROAD',x:s.x,y:s.y}),false);
      if(action.type==='farm') add(action.label,()=>dispatch({type:'build',building:'FARM',x:s.x,y:s.y}),false);
      if(action.type==='mine') add(action.label,()=>dispatch({type:'build',building:'MINE',x:s.x,y:s.y}),false);
      if(action.type==='hut') add(action.label,()=>dispatch({type:'build',building:'HUT',x:s.x,y:s.y}),false);
      if(action.type==='temple') add(action.label,()=>dispatch({type:'build',building:'TEMPLE',x:s.x,y:s.y}),false);
      if(action.type==='forest') add(action.label,()=>dispatch({type:'build',building:'FOREST',x:s.x,y:s.y}),false);
      if(action.type==='clear') add(action.label,()=>dispatch({type:'build',building:'CLEAR_FOREST',x:s.x,y:s.y}),false);
      if(action.type==='burn') add(action.label,()=>dispatch({type:'build',building:'BURN_FOREST',x:s.x,y:s.y}),false);
      if(action.type==='forestTemple') add(action.label,()=>dispatch({type:'build',building:'FOREST_TEMPLE',x:s.x,y:s.y}),false);
      if(action.type==='waterTemple') add(action.label,()=>dispatch({type:'build',building:'WATER_TEMPLE',x:s.x,y:s.y}),false);
      if(action.type==='sawmill') add(action.label,()=>dispatch({type:'build',building:'SAWMILL',x:s.x,y:s.y}),false);
      if(action.type==='forge') add(action.label,()=>dispatch({type:'build',building:'FORGE',x:s.x,y:s.y}),false);
      if(action.type==='customHouse') add(action.label,()=>dispatch({type:'build',building:'CUSTOM_HOUSE',x:s.x,y:s.y}),false);
      if(action.type==='embassy') add(action.label,()=>dispatch({type:'build',building:'EMBASSY',x:s.x,y:s.y}),false);
    }
    if(city&&city.owner!==viewerId&&unit&&unit.owner===viewerId) add('Осадить город',()=>showToast('Займите клетку с городом и удержите её до начала своего следующего хода.'),false);
    if(state.mode==='online'&&state.roomHost&&state.room&&!state.room.started) return;
  }
  function armTarget(mode) {
    if(!state.selected) return; state.targetMode=mode;
    const map=$('game-map'); map.querySelectorAll('.map-tile').forEach(tile=>tile.classList.remove('path-target'));
    $('map-help').textContent=mode==='move'?'Теперь выберите клетку назначения.':mode==='attack'?'Теперь выберите вражеский отряд.':'Выберите цель специального действия.';
    showToast(mode==='move'?'Выберите клетку для перемещения.':mode==='attack'?'Выберите врага для атаки.':'Выберите соседнюю цель.');
  }
  function onTileClick(x,y) {
    if(!state.game) return;
    const game=state.game; const view=viewGame(); const target=E.tileAt(game,x,y); const viewTarget=E.tileAt(view,x,y); const viewerId=currentViewingPlayerId();
    if(!target||!viewTarget) return;
    if(state.targetMode && state.selected) {
      const from=state.selected; const source=E.tileAt(game,from.x,from.y);
      const mode=state.targetMode; state.targetMode=null;
      if(mode==='move') dispatch({type:'move',x:from.x,y:from.y,toX:x,toY:y});
      else if(mode==='attack') { if(!viewTarget.unit || viewTarget.unit.owner===viewerId) { showToast('Выберите видимый вражеский отряд.'); state.targetMode='attack'; return; } dispatch({type:'attack',x:from.x,y:from.y,toX:x,toY:y}); }
      else if(mode==='special') { if(viewTarget.terrain==='UNKNOWN') { showToast('Цель не исследована.'); state.targetMode='special'; return; } dispatch({type:'special',x:from.x,y:from.y,toX:x,toY:y}); }
      return;
    }
    // One click attacks an adjacent/visible enemy if the player has selected an attacker.
    if(state.selected && state.game.activePlayer===viewerId && isMyTurn()) {
      const from=E.tileAt(game,state.selected.x,state.selected.y);
      if(from?.unit?.owner===viewerId && viewTarget.unit && viewTarget.unit.owner!==viewerId && E.unitDef(from.unit).range>=Math.max(Math.abs(target.x-from.x),Math.abs(target.y-from.y)) && !from.unit.attackedThisTurn) {
        dispatch({type:'attack',x:from.x,y:from.y,toX:x,toY:y}); return;
      }
    }
    state.selected={x,y}; state.targetMode=null; renderAll();
  }
  function renderTech(game, viewerId) {
    const p=E.playerById(game,viewerId); if(!p) return;
    const researched=E.TECHS.filter(t=>p.techs.includes(t.id));
    const list=researched.slice(-6).map(t=>`<span class="tech-chip">${escapeHtml(t.name)}</span>`).join('');
    const next=E.legalResearch(game,p).slice(0,2).map(t=>`<span class="tech-chip locked" title="${escapeHtml(t.desc)}">${escapeHtml(t.name)} · ${t.cost}★</span>`).join('');
    $('tech-summary').innerHTML=list+next||'<span class="muted-label">Пока нет изученных технологий</span>';
  }
  function renderLog(game) {
    const log=$('game-log'); const entries=(game.log||[]).slice(-8).reverse();
    log.innerHTML=entries.map(entry=>`<div class="log-entry"><span class="log-meta">ХОД ${entry.turn} · ${escapeHtml(E.playerById(game,entry.playerId)?.name||'Мир')}</span>${escapeHtml(entry.text)}</div>`).join('')||'<div class="muted-label">Событий пока нет.</div>';
  }
  function renderEmpire(game, viewerId) {
    const p=E.playerById(game,viewerId); const cities=E.citiesOf(game,viewerId); const units=E.unitsOf(game,viewerId);
    $('city-count').textContent=`${cities.length} ${cities.length===1?'город':cities.length>=2&&cities.length<=4?'города':'городов'}`;
    $('empire-summary').innerHTML=`<div class="summary-stat"><span>Доход / ход</span><strong class="gold">${p.spt}★</strong></div><div class="summary-stat"><span>Очки</span><strong>${p.score}</strong></div><div class="summary-stat"><span>Отряды</span><strong>${units.length}</strong></div><div class="summary-stat"><span>Технологии</span><strong>${p.techs.length} / ${E.TECHS.length}</strong></div><div class="summary-stat"><span>Памятники</span><strong>${(p.monuments||[]).length} / ${E.MONUMENTS.length}</strong></div><div class="summary-stat"><span>Столица</span><strong>${cities.some(t=>t.city.capital)?'Сохранена':'Потеряна'}</strong></div>`;
  }
  function showWinnerBanner(game) {
    if($('winner-banner')) return;
    const winner=game.winner?E.playerById(game,game.winner):null;
    const banner=document.createElement('div'); banner.className='winner-banner'; banner.id='winner-banner'; banner.textContent=winner?`Партия завершена. Победитель: ${winner.name}.`:'Партия завершена.';
    $('game-topline').insertAdjacentElement('afterend',banner);
  }
  function clearWinnerBanner() { const old=$('winner-banner'); if(old) old.remove(); }
  function maybeOpenMonumentReward() {
    if(!state.game || !isMyTurn() || !$('modal-backdrop').classList.contains('hidden')) return;
    const p=E.playerById(state.game,currentViewingPlayerId()); const pending=p&&p.pendingMonuments&&p.pendingMonuments[0];
    if(pending) openMonumentReward(pending);
  }
  function openMonumentReward(monument) {
    const p=E.playerById(state.game,currentViewingPlayerId()); const cities=E.citiesOf(state.game,p.id);
    const html=`<p class="modal-intro">Условие выполнено: ${escapeHtml(monument.name)}. Выберите город, который получит +3 населения. Награда также даёт +400 очков.</p><div class="modal-grid">${cities.map(t=>`<button class="modal-option" data-city="${escapeHtml(t.city.id)}"><strong>${escapeHtml(t.city.capital?'Столица':`Город ${t.x},${t.y}`)}</strong><small>Уровень ${t.city.level} · население ${t.city.population}</small></button>`).join('')}</div>`;
    showModal(`Награда: ${monument.name}`,html,'ПАМЯТНИК');
    $('modal-content').querySelectorAll('[data-city]').forEach(btn=>btn.addEventListener('click',async()=>{await dispatch({type:'claimMonument',monumentId:monument.id,cityId:btn.dataset.city});closeModal();renderAll();}));
  }
  function showModal(title, content, eyebrow) {
    $('modal-title').textContent=title; $('modal-eyebrow').textContent=eyebrow||'УПРАВЛЕНИЕ'; $('modal-content').innerHTML=content; $('modal-backdrop').classList.remove('hidden'); state.modalKind=title;
  }
  function closeModal() { $('modal-backdrop').classList.add('hidden'); $('modal-content').innerHTML=''; state.modalKind=null; if(state.game) queueMicrotask(maybeOpenMonumentReward); }
  function openTechTree() {
    if(!state.game) return; const p=E.playerById(state.game,currentViewingPlayerId());
    let html='<p class="modal-intro">Стоимость зависит от количества ваших городов. Философия снижает цену будущих технологий на 33%. Нажмите на изучаемую технологию, чтобы потратить звёзды.</p>';
    for(let tier=1;tier<=3;tier++) {
      html+=`<div class="tech-tier">УРОВЕНЬ ${tier} · БАЗОВАЯ ЦЕНА ${({1:5,2:6,3:7})[tier]}★ × города</div><div class="tech-list">`;
      E.TECHS.filter(t=>t.tier===tier).forEach(t=>{
        const learned=p.techs.includes(t.id), avail=E.legalResearch(state.game,p).some(v=>v.id===t.id), cost=E.techCost(state.game,p,t.id), affordable=p.stars>=cost;
        const req=(t.req||[]).map(id=>E.TECHS.find(x=>x.id===id)?.name||id).join(', ');
        html+=`<div class="tech-row ${learned?'researched':''}"><div><h3>${escapeHtml(t.name)} ${learned?'✓':''}</h3><p>${escapeHtml(t.desc)}${req&&!learned?` · Нужно: ${escapeHtml(req)}`:''}</p><p class="tech-lore">${escapeHtml(t.lore||'')}</p></div><div><div class="tech-cost">${learned?'Изучено':`${cost}★`}</div><button class="secondary-button modal-button" data-tech="${t.id}" ${learned||!avail||!affordable||!isMyTurn()?'disabled':''}>${learned?'Готово':!avail?'Закрыто':'Изучить'}</button></div></div>`;
      }); html+='</div>';
    }
    showModal('Древо технологий',html,'ИССЛЕДОВАНИЯ');
    $('modal-content').querySelectorAll('[data-tech]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.tech;await dispatch({type:'research',techId:id});if(!state.game?.over) openTechTree();else closeModal();}));
  }
  function openTrainModal(x,y) {
    const p=E.playerById(state.game,currentViewingPlayerId()), tile=E.tileAt(state.game,x,y); if(!tile?.city||tile.city.owner!==p.id) return;
    const count=E.unitsOf(state.game,p.id).length;
    let html=`<p class="modal-intro">Город уровня ${tile.city.level} поддерживает до ${tile.city.level} обычных отрядов. Сейчас у вас ${count} отрядов. Выберите тип, чтобы обучить его за звёзды.</p><div class="modal-grid">`;
    const types=['WARRIOR','RIDER','ARCHER','DEFENDER','SWORDSMAN','KNIGHT','CATAPULT','MIND_BENDER','CLOAK','SCOUT_SHIP','RAMMER','BOMBER'];
    types.forEach(id=>{const u=E.UNITS[id];const techOK=!u.req||E.hasTech(p,u.req);const costOK=p.stars>=u.cost;const domainOK=u.domain!=='naval'||tile.building?.type==='PORT';const cityUnitCount=E.unitsOf(state.game,p.id).filter(v=>v.unit.homeCityId===tile.city.id&&!E.unitDef(v.unit).giant).length;const capOK=cityUnitCount<tile.city.level;const disabled=!techOK||!costOK||!domainOK||!capOK||!isMyTurn(); const note=!techOK?`Нужно: ${E.TECHS.find(t=>t.id===u.req)?.name||u.req}`:!costOK?'Не хватает звёзд':!domainOK?'Нужен порт':!capOK?'Нет свободной вместимости':`${u.hp} HP · атака ${u.atk} · дальность ${u.range}`;
      html+=`<button class="modal-option" data-unit="${id}" ${disabled?'disabled':''}><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(note)}</small><span class="option-cost">${u.cost}★ · движение ${u.move}</span></button>`;
    }); html+='</div>';
    showModal('Обучить отряд',html,'ВОЙСКА');
    $('modal-content').querySelectorAll('[data-unit]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.unit;await dispatch({type:'train',x,y,unitType:id});closeModal();}));
  }
  function openCityUpgrade(x,y) {
    const t=E.tileAt(state.game,x,y); if(!t?.city) return;
    const c=t.city; const next=Math.min(5,c.level+1); const choices=E.LEVEL_BONUSES[next]||E.LEVEL_BONUSES[5];
    const html=`<p class="modal-intro">Город достиг нужного населения. Улучшение поднимает уровень, навсегда увеличивает доход на +1★ за ход и требует выбрать один бонус.</p><div class="modal-grid">${choices.map(b=>`<button class="modal-option" data-bonus="${b.id}" ${!isMyTurn()?'disabled':''}><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.desc)}</small></button>`).join('')}</div>`;
    showModal(`Улучшить город · уровень ${next}`,html,'РАЗВИТИЕ');
    $('modal-content').querySelectorAll('[data-bonus]').forEach(btn=>btn.addEventListener('click',async()=>{await dispatch({type:'upgradeCity',x,y,bonus:btn.dataset.bonus});closeModal();}));
  }
  function openDiplomacy() {
    const p=E.playerById(state.game,currentViewingPlayerId());
    const foes=state.game.players.filter(q=>q.id!==p.id);
    const html=`<p class="modal-intro">Договор о мире запрещает атаки между участниками и позволяет проходить через чужие земли. Статус отношений действует в обе стороны.</p><div class="tech-list">${foes.map(q=>`<div class="tech-row"><div><h3>${escapeHtml(q.name)}</h3><p>Текущий статус: ${escapeHtml((p.relations?.[q.id]?.type)||'NEUTRAL')}</p></div><div><select class="modal-input diplomacy-select" data-player="${q.id}" style="height:32px;padding:0 7px;font-size:10px"><option value="NEUTRAL">Нейтралитет</option><option value="PEACE">Мир</option><option value="WAR">Война</option></select></div></div>`).join('')}</div><div class="modal-actions"><button id="apply-diplomacy" class="primary-button">Применить</button></div>`;
    showModal('Дипломатия',html,'ОТНОШЕНИЯ');
    $('apply-diplomacy').addEventListener('click',async()=>{for(const sel of $('modal-content').querySelectorAll('.diplomacy-select')) await dispatch({type:'relation',otherPlayerId:Number(sel.dataset.player),relation:sel.value});closeModal();});
  }
  function onStyle(style) {
    state.mapStyle=style; localStorage.setItem(STYLE_KEY,style);
    document.querySelectorAll('.style-button').forEach(b=>b.classList.toggle('active',b.dataset.style===style)); if(state.game) renderMap(viewGame(),currentViewingPlayerId());
  }
  async function endCurrentTurn() {
    if(!state.game||!isMyTurn()||state.game.over) return;
    $('action-error').textContent='';
    if(state.mode==='online') {
      try { await sendOnlineEndTurn(); } catch(err) { showToast(err.message); }
    } else {
      try { E.endTurn(state.game,state.game.activePlayer); state.selected=null; state.targetMode=null; saveQuietly(); renderAll(); if(state.mode==='bots') runAIs(); }
      catch(err) { showToast(err.message); }
    }
  }
  function runAIs() {
    if(!state.game||state.mode==='online'||state.mode==='local') return;
    if(state.aiTimer) clearTimeout(state.aiTimer);
    const current=E.playerById(state.game,state.game.activePlayer);
    if(current&&current.isAI&&!state.game.over) {
      state.busy=true; $('turn-status').textContent='Бот думает…'; $('end-turn').disabled=true;
      state.aiTimer=setTimeout(()=>{
        E.advanceAI(state.game,Math.max(1,state.game.players.filter(p=>p.isAI).length+1));
        state.busy=false; state.selected=null; state.targetMode=null; saveQuietly(); renderAll();
        if(E.playerById(state.game,state.game.activePlayer)?.isAI) runAIs();
      },320);
    }
  }
  function bindMap() {
    $('game-map').addEventListener('click',e=>{const tile=e.target.closest('.map-tile');if(!tile)return;onTileClick(Number(tile.dataset.x),Number(tile.dataset.y));});
  }

  document.querySelectorAll('.mode-tab').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode)));
  $('start-game').addEventListener('click',()=>{
    if(state.mode==='online') { createOnlineRoom(); return; }
    clearWinnerBanner(); startLocalGame();
  });
  $('edit-server').addEventListener('click',()=>{
    $('server-edit-row').classList.toggle('hidden');
    $('server-url').value=state.serverUrl;
    if(!$('server-edit-row').classList.contains('hidden')) $('server-url').focus();
  });
  $('save-server').addEventListener('click',()=>{
    state.serverUrl=normalizeServer($('server-url').value); localStorage.setItem(SERVER_KEY,state.serverUrl); $('server-url').value=state.serverUrl; $('server-address-label').textContent=state.serverUrl; $('server-edit-row').classList.add('hidden'); pingServer();
  });
  $('join-room').addEventListener('click',()=>{
    const row=$('join-code-field');
    if(!row.classList.contains('hidden')) { joinOnlineRoom(); return; }
    row.classList.remove('hidden'); $('join-room').textContent='Подключиться'; row.style.marginTop='10px'; $('join-code').focus();
  });
  $('join-code').addEventListener('keydown',e=>{if(e.key==='Enter')joinOnlineRoom();});
  $('start-online').addEventListener('click',startOnlineRoom);
  $('copy-room-code').addEventListener('click',()=>{const code=$('room-code').textContent;if(navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(()=>showToast('Код комнаты скопирован.')).catch(()=>showToast(`Код комнаты: ${code}`));else showToast(`Код комнаты: ${code}`);});
  $('save-game').addEventListener('click',saveLocalGame);
  $('back-to-menu').addEventListener('click',()=>{const wasSpectating=state.spectating;saveQuietly();stopRoomPolling();stopSpectatorPolling();clearWinnerBanner();setGameScreens(false);state.selected=null;state.targetMode=null; if(wasSpectating){state.mode='online';setMode('online');state.roomCode=null;return;} if(state.roomCode){$('room-lobby').classList.remove('hidden');$('room-code').textContent=state.roomCode;$('start-game').classList.add('hidden');} else $('start-game').classList.toggle('hidden',state.mode==='online');});
  $('end-turn').addEventListener('click',endCurrentTurn);
  $('open-tech-tree').addEventListener('click',openTechTree);
  $('open-diplomacy').addEventListener('click',openDiplomacy);
  $('close-modal').addEventListener('click',closeModal);
  $('modal-backdrop').addEventListener('click',e=>{if(e.target===$('modal-backdrop'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal(); if(e.key==='Enter'&&e.ctrlKey&&state.game) endCurrentTurn();});
  document.querySelectorAll('.style-button').forEach(btn=>btn.addEventListener('click',()=>onStyle(btn.dataset.style)));
  $('zoom-in').addEventListener('click',()=>{state.zoom=Math.min(48,state.zoom+3);if(state.game)renderMap(viewGame(),currentViewingPlayerId());});
  $('zoom-out').addEventListener('click',()=>{state.zoom=Math.max(22,state.zoom-3);if(state.game)renderMap(viewGame(),currentViewingPlayerId());});
  bindMap();
  function applyInterfaceSettings() {
    const root=document.documentElement;
    const preset=localStorage.getItem('strategy-theme')||'forest'; root.dataset.theme=preset;
    const accent=localStorage.getItem('strategy-accent'); if(accent) root.style.setProperty('--accent',accent);
    root.dataset.density=localStorage.getItem('strategy-density')||'comfortable';
    root.dataset.radius=localStorage.getItem('strategy-radius')||'soft';
    root.dataset.font=localStorage.getItem('strategy-font')||'system';
    const scale=Number(localStorage.getItem('strategy-scale')||100); root.style.setProperty('--ui-scale',String(scale/100));
    $('theme-preset').value=preset; $('theme-accent').value=accent||({'forest':'#cfe8a2','midnight':'#a8b7ff','parchment':'#687b3b','ocean':'#70d7cc','plum':'#e1a9ff','contrast':'#ffff00','mono':'#e6e6e6'}[preset]||'#cfe8a2');
    $('ui-density').value=root.dataset.density; $('ui-radius').value=root.dataset.radius; $('ui-font').value=root.dataset.font; $('ui-scale').value=scale;
  }
  function bindInterfaceSettings() {
    $('site-settings-toggle').addEventListener('click',()=>{const panel=$('site-settings');const open=panel.classList.toggle('hidden')===false;$('site-settings-toggle').setAttribute('aria-expanded',String(open));});
    $('theme-preset').addEventListener('change',()=>{document.documentElement.dataset.theme=$('theme-preset').value;localStorage.setItem('strategy-theme',$('theme-preset').value);});
    $('theme-accent').addEventListener('input',()=>{document.documentElement.style.setProperty('--accent',$('theme-accent').value);localStorage.setItem('strategy-accent',$('theme-accent').value);});
    $('ui-density').addEventListener('change',()=>{document.documentElement.dataset.density=$('ui-density').value;localStorage.setItem('strategy-density',$('ui-density').value);});
    $('ui-radius').addEventListener('change',()=>{document.documentElement.dataset.radius=$('ui-radius').value;localStorage.setItem('strategy-radius',$('ui-radius').value);});
    $('ui-font').addEventListener('change',()=>{document.documentElement.dataset.font=$('ui-font').value;localStorage.setItem('strategy-font',$('ui-font').value);});
    $('ui-scale').addEventListener('input',()=>{document.documentElement.style.setProperty('--ui-scale',String(Number($('ui-scale').value)/100));localStorage.setItem('strategy-scale',$('ui-scale').value);});
  }
  function openTribeInfo() {
    const tribe=tribesById[$('tribe-select').value]; if(!tribe) return;
    const techNames=(tribe.techs||[]).map(id=>E.TECHS.find(t=>t.id===id)?.name||id).join(', ')||'Нет стартовой технологии';
    const html=`<div class="tribe-details"><div class="tribe-mark">${escapeHtml(tribe.id.replace(/_/g,' ').slice(0,2))}</div><div><strong>${escapeHtml(tribe.name)}</strong><p>${escapeHtml(tribe.lore||'Описание племени отсутствует.')}</p><p><b>Стиль:</b> ${escapeHtml(tribe.identity||'—')}</p><p><b>Особенность:</b> ${escapeHtml(tribe.bonusText||'—')}</p><p><b>Стартовые технологии:</b> ${escapeHtml(techNames)}</p></div></div>`;
    showModal(tribe.name,html,'ПЛЕМЯ');
  }
  function bindSetupSettings() {
    $('map-size').addEventListener('change',()=> $('custom-size-field').classList.toggle('hidden',$('map-size').value!=='custom'));
    $('map-type').addEventListener('change',()=> { const custom=$('map-type').value==='CUSTOM'; $('custom-world-panel').classList.toggle('hidden',!custom); if(custom) $('custom-world').focus(); });
    $('custom-world-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{$('custom-world').value=await file.text();$('map-type').value='CUSTOM';$('custom-world-panel').classList.remove('hidden');const rows=customWorldRows();$('map-size').value='custom';$('custom-size-field').classList.remove('hidden');$('custom-map-size').value=rows.length;}catch(err){showError(err.message);}});
    $('tribe-info').addEventListener('click',openTribeInfo);
    $('refresh-rooms').addEventListener('click',refreshPublicRooms);
    $('pause-room').addEventListener('click',()=>roomControl('pause'));
    $('resume-room').addEventListener('click',()=>roomControl('resume'));
    $('replace-player').addEventListener('click',()=>{const field=$('replace-player-field');if(field.classList.contains('hidden'))field.classList.remove('hidden');else roomControl('replace',{targetPlayerId:Number($('replace-player-id').value)});});
    $('recreate-room').addEventListener('click',()=>roomControl('recreate'));
    $('close-room').addEventListener('click',()=>roomControl('close'));
    $('clear-log').addEventListener('click',()=>{$('game-log').innerHTML='';});
  }
  bindInterfaceSettings(); bindSetupSettings(); applyInterfaceSettings();
  // Default endpoint is tested immediately; the URL stays read-only until the user presses “Изменить”.
  $('server-address-label').textContent=state.serverUrl;
  $('server-url').value=state.serverUrl;
  $('server-edit-row').classList.add('hidden');
  setMode('bots'); pingServer(); tryLoadSave();

  // Keep a user-requested online room resumable after a reload in the same browser.
  try {
    const saved=JSON.parse(localStorage.getItem(ROOM_KEY)||'null');
    if(saved && saved.code && saved.playerId && saved.playerToken && normalizeServer(saved.url)===state.serverUrl) {
      const resume=document.createElement('button');resume.type='button';resume.className='secondary-button';resume.textContent='Вернуться в онлайн-комнату';
      resume.addEventListener('click',()=>{
        state.mode='online';setMode('online');state.roomCode=saved.code;state.playerId=saved.playerId;state.playerToken=saved.playerToken;state.roomHost=!!saved.host;$('room-lobby').classList.remove('hidden');$('room-code').textContent=saved.code;$('start-game').classList.add('hidden');pollRoom();
      });
      $('start-game').insertAdjacentElement('beforebegin',resume);
    }
  } catch(_) {}
})();
