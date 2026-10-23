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
    zoom: 34, lastRender: 0, busy: false, modalKind: null, gameMode: 'DOMINATION', previousRoomSync: null
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
    $('local-count-field').classList.toggle('hidden', mode!=='local');
    $('online-settings').classList.toggle('hidden',mode!=='online');
    $('room-lobby').classList.toggle('hidden',mode!=='online');
    if(mode==='online'&&!state.roomCode) { $('room-code').textContent='------'; $('room-lobby').querySelector('.room-code-wrap').classList.add('hidden'); $('start-online').classList.add('hidden'); $('join-room').classList.remove('hidden'); $('join-code-field').classList.add('hidden'); $('join-room').textContent='Войти по коду'; }
    $('start-game').classList.toggle('hidden',mode==='online'&&!!state.roomCode);
    $('mode-note').textContent = mode==='bots' ? 'Прогресс сохраняется в этом браузере' : mode==='local' ? 'Передавайте устройство следующему игроку' : 'Онлайн-комнаты работают через Render';
    if(mode==='online') { setConnection('', 'Проверка сервера'); pingServer(); }
    else setConnection('', 'Локальная игра');
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
    if(!state.game) return false;
    if(state.mode==='online') return Number(state.game.activePlayer)===Number(state.playerId) && !state.game.over;
    return !currentTurnPlayer()?.isAI && !state.game.over;
  }
  function currentViewingPlayerId() { return state.mode==='online' ? Number(state.playerId) : Number(state.game?.activePlayer||1); }
  function viewGame() {
    if(!state.game) return null;
    const id=currentViewingPlayerId();
    try { return E.getPlayerView(state.game,id); } catch (_) { return state.game; }
  }
  function localHumanCount() { return Number($('local-count').value||2); }
  function configPlayers() {
    const name=($('player-name').value.trim()||'Игрок 1').slice(0,22); const tribe=$('tribe-select').value;
    const configs=[{name,tribe,isAI:false}];
    if(state.mode==='bots') {
      const count=Number($('bot-count').value||3);
      for(let i=0;i<count;i++) {
        let t=E.TRIBES[(E.TRIBES.findIndex(x=>x.id===tribe)+1+i)%E.TRIBES.length];
        if(t.id===tribe) t=E.TRIBES[(i+1)%E.TRIBES.length];
        configs.push({name:`Бот ${i+2}`,tribe:t.id,isAI:true});
      }
    } else if(state.mode==='local') {
      const count=localHumanCount();
      for(let i=1;i<count;i++) {
        let t=E.TRIBES[(E.TRIBES.findIndex(x=>x.id===tribe)+i)%E.TRIBES.length];
        if(t.id===tribe) t=E.TRIBES[i%E.TRIBES.length];
        configs.push({name:`Игрок ${i+1}`,tribe:t.id,isAI:false});
      }
    }
    return configs;
  }
  function startLocalGame() {
    stopRoomPolling(); state.roomCode=null; state.playerId=null; state.room=null;
    const game=E.createGame({name:$('player-name').value.trim()||'Игрок 1',tribe:$('tribe-select').value,mapSize:Number($('map-size').value),players:configPlayers(),gameMode:'DOMINATION'});
    state.game=game; state.localPlayerId=1; state.selected=null; state.targetMode=null;
    try { localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify({game,mode:state.mode,savedAt:Date.now()})); } catch(_) {}
    showGame(); if(state.mode==='bots') runAIs();
  }
  function saveLocalGame() {
    if(!state.game||state.mode==='online') { showToast('Онлайн-партия хранится на сервере, пока комната запущена.'); return; }
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
    $('game-heading').textContent='Карта мира';
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
      const data=await api('/api/rooms',{method:'POST',body:{name:$('player-name').value.trim()||'Игрок 1',tribe:$('tribe-select').value,mapSize:Number($('map-size').value),maxPlayers:4,gameMode:'DOMINATION'}});
      state.roomCode=data.code; state.playerId=data.playerId; state.playerToken=data.playerToken; state.roomHost=true; state.room=data.room||null; state.game=null; saveRoomSession();
      $('room-lobby').classList.remove('hidden'); $('room-lobby').querySelector('.room-code-wrap').classList.remove('hidden'); $('room-code').textContent=data.code; $('start-game').classList.add('hidden');
      setConnection('online','Комната создана'); renderLobby(data.room); pollRoom();
      showToast('Комната создана. Отправьте код другим игрокам.');
    } catch(err) { showError(err.message); $('server-ping').textContent='Ошибка соединения'; $('server-ping').className='ping-state bad'; }
  }
  async function joinOnlineRoom() {
    const code=$('join-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,''); if(code.length<4) { showError('Введите код комнаты.'); return; }
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
    $('room-players').innerHTML=players.map(p=>`<span class="room-player-chip">${escapeHtml(p.name)}${p.isHost?' · хост':''}</span>`).join('') + (room.started?'<span class="room-player-chip">Матч начат</span>':'');
    $('start-online').disabled=!state.roomHost||players.length<2||room.started;
    $('start-online').textContent=room.started?'Матч начат':players.length<2?'Ожидание игрока…':'Начать матч';
    $('start-online').classList.toggle('hidden',!state.roomHost);
    $('join-room').classList.toggle('hidden',state.roomHost);
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
  function saveQuietly() { if(!state.game||state.mode==='online') return; try { localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify({game:state.game,mode:state.mode,savedAt:Date.now()})); } catch(_) {} }
  function renderAll() {
    if(!state.game) return;
    const game=state.game, viewingId=currentViewingPlayerId(), viewing=E.playerById(game,viewingId), turn=E.playerById(game,game.activePlayer), visibleGame=viewGame();
    if(!viewing) return;
    $('game-subtitle').textContent=`${game.mode==='online'?'ОНЛАЙН · ':''}ХОД ${game.turn}`;
    $('turn-badge').textContent=`ХОД ${game.turn}`;
    $('active-player-label').textContent=turn ? `Ход: ${turn.name}` : 'Ход завершён';
    $('turn-status').textContent=game.over?'Завершено':isMyTurn()?'Ваш ход':'Ожидание';
    $('end-turn').disabled=!isMyTurn()||state.busy||game.over;
    $('end-turn').innerHTML=state.mode==='local'&&turn&&!turn.isAI&&turn.id!==1?'Передать ход <span aria-hidden="true">→</span>':'Завершить ход <span aria-hidden="true">→</span>';
    $('turn-tip').textContent=game.over ? (game.winner?`Победитель: ${E.playerById(game,game.winner)?.name||'—'}`:'Партия завершена.') : !isMyTurn() ? (state.mode==='online'?'Ждём действия активного игрока.':'Сейчас ход бота.') : state.mode==='local'&&turn.id!==1?`Передайте устройство игроку «${turn.name}».`:'Собирайте ресурсы, изучайте технологии и захватывайте нейтральные города.';
    renderPlayers(game,viewingId);
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
  function renderMap(game, viewerId) {
    const map=$('game-map'); map.classList.remove('view-ascii','view-pixel','view-vector'); map.classList.add(`view-${state.mapStyle}`);
    map.style.gridTemplateColumns=`repeat(${game.mapSize}, var(--cell-size))`; map.style.setProperty('--cell-size',`${state.zoom}px`);
    let found=0, explored=0, total=game.mapSize*game.mapSize, html='';
    const selected=state.selected;
    for(let y=0;y<game.mapSize;y++) for(let x=0;x<game.mapSize;x++) {
      const t=game.grid[y][x]; const real=state.game.grid[y][x];
      const isVisible=real.visibleTo&&real.visibleTo.includes(Number(viewerId)); const isExplored=real.exploredBy&&real.exploredBy.includes(Number(viewerId));
      if(isExplored) explored++; if(isVisible) found++;
      const unknown=t.terrain==='UNKNOWN'; const terrain=unknown?'UNKNOWN':t.terrain;
      const selectedClass=selected&&selected.x===x&&selected.y===y?'selected':'';
      const classes=['map-tile',unknown?'fog':`terrain-${terrain.toLowerCase()}`,isVisible?'visible':isExplored?'explored-hidden':'fog',selectedClass,t.city?'tile-city':'',t.hasRoad?'tile-road':'',t.building?'tile-building':''].filter(Boolean).join(' ');
      const unit=t.unit; const unitOwner=unit&&E.playerById(state.game,unit.owner); const unitColor=unitOwner?.color||'#708278';
      const cityOwner=t.city && (t.city.owner===0?null:E.playerById(state.game,t.city.owner));
      const res= !unknown&&t.resource?resourceSymbol[t.resource]||'*':'';
      let top='';
      if(state.mapStyle==='ascii') {
        const base=unknown?'?':(t.city?`C${t.city.owner||'0'}`:E.TERRAIN_INFO[t.terrain]?.glyph||'?');
        const second=res || (t.building?(buildingShort[t.building.type]||'B'):(t.hasRoad?'R':''));
        top=`${base}${second||' '}`;
      } else if(t.city) top=t.city.owner===viewerId?'⌂':t.city.owner===0?'⌂':'⌗';
      else if(unknown) top='·';
      else top=terrainSymbol[t.terrain]||'?';
      const unitLine=unit?`<span class="unit-label" style="--unit-color:${escapeHtml(unitColor)}">${escapeHtml(`${unitGlyph[unit.type]||'?'}`)}${unit.owner}</span>`:'';
      const title=unknown?`Неизведанная клетка ${x},${y}`:`${E.TERRAIN_INFO[t.terrain]?.label||t.terrain}${t.resource?`, ${E.RESOURCE_INFO[t.resource]?.label||t.resource}`:''}${t.city?`, ${t.city.owner===0?'нейтральный город':`город ${cityOwner?.name||'игрока'}`}`:''}${unit?`, ${E.UNITS[unit.type]?.name||unit.type}`:''} · ${x},${y}`;
      const resMarkup=state.mapStyle==='ascii'||!res?'':`<span class="tile-resource">${escapeHtml(res)}</span>`;
      const cityName=t.city&&t.city.owner===viewerId?'tile-city-owned':'';
      html+=`<button type="button" role="gridcell" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}" class="${classes} ${cityName}" data-x="${x}" data-y="${y}" ${(!isMyTurn()&&!unknown)?'':''}><span class="tile-topline">${escapeHtml(top)}</span>${resMarkup}<span class="tile-unitline">${unitLine}</span></button>`;
    }
    map.innerHTML=html;
    $('visible-count').textContent=`Открыто ${Math.round(explored/total*100)}% карты`;
    $('map-coordinates').textContent=selected?`x: ${String(selected.x).padStart(2,'0')} · y: ${String(selected.y).padStart(2,'0')}`:'x: — · y: —';
    $('map-help').textContent=state.targetMode==='move'?'Выберите клетку назначения.':state.targetMode==='attack'?'Выберите вражеский отряд.':state.targetMode==='special'?'Выберите цель специального действия.':isMyTurn()?'Выберите клетку, отряд или город.':'Сейчас ход другого игрока.';
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
        html+=`<div class="tech-row ${learned?'researched':''}"><div><h3>${escapeHtml(t.name)} ${learned?'✓':''}</h3><p>${escapeHtml(t.desc)}${req&&!learned?` · Нужно: ${escapeHtml(req)}`:''}</p></div><div><div class="tech-cost">${learned?'Изучено':`${cost}★`}</div><button class="secondary-button modal-button" data-tech="${t.id}" ${learned||!avail||!affordable||!isMyTurn()?'disabled':''}>${learned?'Готово':!avail?'Закрыто':'Изучить'}</button></div></div>`;
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
  $('back-to-menu').addEventListener('click',()=>{saveQuietly();stopRoomPolling();clearWinnerBanner();setGameScreens(false);state.selected=null;state.targetMode=null; if(state.roomCode){$('room-lobby').classList.remove('hidden');$('room-code').textContent=state.roomCode;$('start-game').classList.add('hidden');} else $('start-game').classList.toggle('hidden',state.mode==='online');});
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
