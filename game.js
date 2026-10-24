(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.GameEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TERRAIN = Object.freeze({ OCEAN: 'OCEAN', WATER: 'WATER', PLAIN: 'PLAIN', FOREST: 'FOREST', MOUNTAIN: 'MOUNTAIN' });
  const RESOURCE = Object.freeze({ FRUIT: 'FRUIT', ANIMAL: 'ANIMAL', FISH: 'FISH', ORE: 'ORE', CROP: 'CROP', WHALE: 'WHALE' });
  const TERRAIN_INFO = {
    OCEAN: { glyph: '~', label: 'Океан', defense: 1 },
    WATER: { glyph: 'w', label: 'Мелководье', defense: 1 },
    PLAIN: { glyph: '.', label: 'Равнина', defense: 1 },
    FOREST: { glyph: 'T', label: 'Лес', defense: 1.5 },
    MOUNTAIN: { glyph: '^', label: 'Гора', defense: 1.5 }
  };
  const RESOURCE_INFO = {
    FRUIT: { glyph: 'f', label: 'Фрукты', tech: 'ORGANIZATION', pop: 1 },
    ANIMAL: { glyph: 'a', label: 'Животные', tech: 'HUNTING', pop: 1 },
    FISH: { glyph: 'o', label: 'Рыба', tech: 'FISHING', pop: 1 },
    ORE: { glyph: 'v', label: 'Руда', tech: 'MINING', pop: 2 },
    CROP: { glyph: 'c', label: 'Зерно', tech: 'FARMING', pop: 2 },
    WHALE: { glyph: 'w', label: 'Кит', tech: 'WHALING', pop: 0, stars: 10 },
    RUINS: { glyph: '*', label: 'Руины', tech: 'FREE_DIVING', pop: 0, stars: 5 }
  };
  const TRIBES = [
    { id: 'IMPERIUS', name: 'Империус', techs: ['ORGANIZATION'], terrain: 'PLAIN', lore: 'Городская республика с сильной организацией, дорогами и устойчивой экономикой.', identity: 'Порядок и развитие', bonusText: 'Начинает с Организации.' },
    { id: 'BARDUR', name: 'Бардур', techs: ['HUNTING'], terrain: 'FOREST', lore: 'Северные поселенцы, приспособленные к жизни среди густых лесов и дикой природы.', identity: 'Лес и охота', bonusText: 'Начинает с Охотой; чаще встречаются леса.' },
    { id: 'OUMAJI', name: 'Оумаджи', techs: ['RIDING'], terrain: 'PLAIN', lore: 'Подвижные кочевники открытых равнин, полагающиеся на скорость и конницу.', identity: 'Скорость и манёвры', bonusText: 'Начинает с Верховой ездой.' },
    { id: 'XIN_XI', name: 'Синь-Си', techs: ['CLIMBING'], terrain: 'MOUNTAIN', lore: 'Горные мастера, использующие трудный рельеф для защиты и добычи ресурсов.', identity: 'Горы и ремесло', bonusText: 'Начинает со Скалолазанием; чаще встречаются горы.' },
    { id: 'KICKOO', name: 'Кикоо', techs: ['FISHING'], terrain: 'WATER', lore: 'Морские общины, связанные торговлей, рыболовством и дальними плаваниями.', identity: 'Вода и торговля', bonusText: 'Начинает с Рыболовством.' },
    { id: 'HOODRICK', name: 'Худрик', techs: ['ARCHERY'], terrain: 'FOREST', lore: 'Лесные лучники, которые предпочитают контролировать поле боя с дистанции.', identity: 'Дальний бой', bonusText: 'Начинает со Стрельбой.' },
    { id: 'LUXIDOOR', name: 'Люксидор', techs: [], level: 2, terrain: 'PLAIN', lore: 'Богатое государство с развитой столицей и внушительными резервами.', identity: 'Богатство и города', bonusText: 'Столица 2-го уровня и 7 звёзд на старте.' },
    { id: 'VENGIR', name: 'Венгир', techs: ['SMITHING'], swordsman: true, terrain: 'MOUNTAIN', lore: 'Воинственное племя суровых земель, сделавшее ставку на тяжёлую пехоту.', identity: 'Тяжёлая пехота', bonusText: 'Начинает с Мечником и Кузнечным делом.' },
    { id: 'ZEBASI', name: 'Зебаси', techs: ['FARMING'], terrain: 'PLAIN', lore: 'Земледельцы плодородных равнин, расширяющие города за счёт пищи и ремесла.', identity: 'Пища и рост', bonusText: 'Начинает с Земледелием.' },
    { id: 'AI_MO', name: 'Ай-Мо', techs: ['MEDITATION'], terrain: 'MOUNTAIN', lore: 'Горные общины созерцателей, развивающие храмы и технологические знания.', identity: 'Знание и храмы', bonusText: 'Начинает с Медитацией.' },
    { id: 'QUETZALI', name: 'Кецали', techs: ['SHIELDS'], terrain: 'FOREST', lore: 'Защитники городов и союзов, которые укрепляют позиции перед расширением.', identity: 'Оборона', bonusText: 'Начинает со Щитами.' },
    { id: 'YADDITH', name: 'Яддит', techs: ['ROADS'], terrain: 'PLAIN', lore: 'Инженерные общины, связывающие поселения дорогами и налаживающие снабжение.', identity: 'Связность и логистика', bonusText: 'Начинает с Дорогами.' }
  ];
  const TECHS = [
    { id: 'ORGANIZATION', name: 'Организация', tier: 1, desc: 'Сбор фруктов. Открывает земледелие и щиты.' },
    { id: 'HUNTING', name: 'Охота', tier: 1, desc: 'Сбор животных. Открывает лесное дело и стрельбу.' },
    { id: 'RIDING', name: 'Верховая езда', tier: 1, desc: 'Всадники. Открывает дороги и свободное ныряние.' },
    { id: 'FISHING', name: 'Рыболовство', tier: 1, desc: 'Сбор рыбы. Открывает мореплавание и китобойный промысел.' },
    { id: 'CLIMBING', name: 'Скалолазание', tier: 1, desc: 'Доступ к горам. Открывает добычу руды и медитацию.' },
    { id: 'FARMING', name: 'Земледелие', tier: 2, req: ['ORGANIZATION'], desc: 'Фермы и сбор зерна.' },
    { id: 'SHIELDS', name: 'Щиты', tier: 2, req: ['ORGANIZATION'], desc: 'Защитники.' },
    { id: 'FORESTRY', name: 'Лесное дело', tier: 2, req: ['HUNTING'], desc: 'Расчистка леса и лесные хижины. Открывает математику.' },
    { id: 'ARCHERY', name: 'Стрельба', tier: 2, req: ['HUNTING'], desc: 'Лучники.' },
    { id: 'ROADS', name: 'Дороги', tier: 2, req: ['RIDING'], desc: 'Дороги ускоряют передвижение и связывают города.' },
    { id: 'FREE_DIVING', name: 'Свободное ныряние', tier: 2, req: ['RIDING'], desc: 'Позволяет исследовать руины на глубине.' },
    { id: 'SAILING', name: 'Мореплавание', tier: 2, req: ['FISHING'], desc: 'Порты и базовые корабли.' },
    { id: 'WHALING', name: 'Китобойный промысел', tier: 2, req: ['FISHING'], desc: 'Киты приносят 10 звёзд.' },
    { id: 'MINING', name: 'Добыча руды', tier: 2, req: ['CLIMBING'], desc: 'Шахты и сбор руды. Открывает кузнечное дело.' },
    { id: 'MEDITATION', name: 'Медитация', tier: 2, req: ['CLIMBING'], desc: 'Горные храмы. Открывает философию.' },
    { id: 'MATHEMATICS', name: 'Математика', tier: 3, req: ['FORESTRY'], desc: 'Катапульты и лесопилки.' },
    { id: 'TRADE', name: 'Торговля', tier: 3, req: ['SAILING', 'ROADS'], desc: 'Торговые дома дают доход за соседние порты.' },
    { id: 'SPIRITUALISM', name: 'Спиритуализм', tier: 3, req: ['MEDITATION'], desc: 'Посадка лесов и лесные храмы.' },
    { id: 'CHIVALRY', name: 'Рыцарство', tier: 3, req: ['RIDING', 'FORESTRY'], desc: 'Рыцари и выжигание лесов.' },
    { id: 'NAVIGATION', name: 'Навигация', tier: 3, req: ['SAILING'], desc: 'Безопасное плавание по океану.' },
    { id: 'AQUATISM', name: 'Акватизм', tier: 3, req: ['SAILING'], desc: 'Защита на воде и водные храмы.' },
    { id: 'SMITHING', name: 'Кузнечное дело', tier: 3, req: ['MINING'], desc: 'Мечники и кузницы.' },
    { id: 'PHILOSOPHY', name: 'Философия', tier: 3, req: ['MEDITATION'], desc: 'Снижает стоимость будущих технологий на 33%.' },
    { id: 'DIPLOMACY', name: 'Дипломатия', tier: 3, req: ['MATHEMATICS'], desc: 'Посольства и плащи.' }
  ];
  const TECH_LORE = {
    ORGANIZATION: 'Первые советы городов вводят общие правила обмена и распределения припасов.',
    HUNTING: 'Следопыты читают следы зверей и передают знания о лесах новым поселениям.',
    RIDING: 'Приручение лошадей превращает большие расстояния в часть повседневной жизни.',
    FISHING: 'Береговые общины учатся читать приливы и возвращаться с уловом даже в непогоду.',
    CLIMBING: 'Горные проводники находят безопасные перевалы и открывают путь к рудным жилам.',
    FARMING: 'Сохранённые семена дают городам надёжные запасы и возможность расти.',
    SHIELDS: 'Общая школа строя учит отряды закрывать друг друга щитами.',
    FORESTRY: 'Лесники сочетают бережную рубку с постройкой новых поселений.',
    ARCHERY: 'Лучники превращают дальность и высоту в преимущество на поле боя.',
    ROADS: 'Каменные дороги объединяют города, ускоряют отряды и упрощают торговлю.',
    FREE_DIVING: 'Ныряльщики исследуют затонувшие руины и достают древние находки.',
    SAILING: 'Корабельщики строят порты и впервые связывают берега регулярными маршрутами.',
    WHALING: 'Морские команды осваивают дальние промыслы и возвращаются с ценным грузом.',
    MINING: 'Шахтёры прокладывают штольни к металлам, нужным для крепких орудий и зданий.',
    MEDITATION: 'Горные обители берегут знания и учат находить пользу в тишине и наблюдении.',
    MATHEMATICS: 'Расчёты инженеров позволяют строить сложные механизмы и эффективные лесопилки.',
    TRADE: 'Купеческие союзы согласуют цены и создают сеть постоянного обмена между портами.',
    SPIRITUALISM: 'Хранители священных рощ восстанавливают леса и возводят места памяти.',
    CHIVALRY: 'Кавалерийские ордена совершенствуют стремительные удары и прорывы строя.',
    NAVIGATION: 'Карты звёзд и течений позволяют пересекать океан увереннее и безопаснее.',
    AQUATISM: 'Морские традиции учат воинов сражаться на воде и строить храмы у побережья.',
    SMITHING: 'Мастера огня превращают руду в оружие, инструменты и прочные конструкции.',
    PHILOSOPHY: 'Школы мысли упорядочивают знания и помогают быстрее осваивать новые идеи.',
    DIPLOMACY: 'Послы, тайные курьеры и договоры влияют на отношения между державами.'
  };
  TECHS.forEach(tech => { tech.lore = TECH_LORE[tech.id] || tech.desc; });
  const UNITS = {
    WARRIOR: { name: 'Воин', short: 'W', hp: 10, atk: 2, def: 2, range: 1, move: 1, cost: 2, req: null, domain: 'land' },
    RIDER: { name: 'Всадник', short: 'R', hp: 10, atk: 2, def: 1, range: 1, move: 2, cost: 3, req: 'RIDING', domain: 'land', escape: true },
    ARCHER: { name: 'Лучник', short: 'A', hp: 10, atk: 2, def: 1, range: 2, move: 1, cost: 3, req: 'ARCHERY', domain: 'land' },
    DEFENDER: { name: 'Защитник', short: 'D', hp: 15, atk: 1, def: 3, range: 1, move: 1, cost: 3, req: 'SHIELDS', domain: 'land' },
    SWORDSMAN: { name: 'Мечник', short: 'S', hp: 15, atk: 3, def: 3, range: 1, move: 1, cost: 5, req: 'SMITHING', domain: 'land' },
    KNIGHT: { name: 'Рыцарь', short: 'K', hp: 15, atk: 3.5, def: 1, range: 1, move: 3, cost: 8, req: 'CHIVALRY', domain: 'land', persist: true },
    CATAPULT: { name: 'Катапульта', short: 'C', hp: 10, atk: 4, def: 1, range: 3, move: 1, cost: 8, req: 'MATHEMATICS', domain: 'land', indirect: true },
    MIND_BENDER: { name: 'Менталист', short: 'M', hp: 10, atk: 0, def: 1, range: 1, move: 1, cost: 5, req: 'PHILOSOPHY', domain: 'land', healer: true },
    GIANT: { name: 'Гигант', short: 'G', hp: 40, atk: 5, def: 4, range: 1, move: 1, cost: 0, req: null, domain: 'land', giant: true },
    CLOAK: { name: 'Плащ', short: 'X', hp: 10, atk: 0, def: 0.5, range: 1, move: 2, cost: 8, req: 'DIPLOMACY', domain: 'land', cloak: true },
    DAGGER: { name: 'Кинжал', short: 'd', hp: 10, atk: 2, def: 2, range: 1, move: 1, cost: 0, req: null, domain: 'land' },
    RAFT: { name: 'Плот', short: 'Rf', hp: 10, atk: 1, def: 1, range: 1, move: 2, cost: 0, req: 'SAILING', domain: 'naval' },
    SCOUT_SHIP: { name: 'Разведкорабль', short: 'Sc', hp: 10, atk: 2, def: 1, range: 2, move: 3, cost: 5, req: 'SAILING', domain: 'naval' },
    RAMMER: { name: 'Таран', short: 'Ra', hp: 15, atk: 3, def: 2, range: 1, move: 3, cost: 5, req: 'SAILING', domain: 'naval' },
    BOMBER: { name: 'Бомбардировщик', short: 'B', hp: 10, atk: 4, def: 1, range: 3, move: 2, cost: 8, req: 'SAILING', domain: 'naval', indirect: true },
    JUGGERNAUT: { name: 'Джаггернаут', short: 'Jg', hp: 40, atk: 4, def: 4, range: 1, move: 2, cost: 0, req: 'SAILING', domain: 'naval', giant: true }
  };
  const LEVEL_BONUSES = {
    2: [{ id: 'stars', name: '+5 звёзд', desc: 'Получить 5 звёзд сейчас.' }, { id: 'workshop', name: 'Мастерская', desc: '+1 звезда за ход.' }],
    3: [{ id: 'wall', name: 'Стена', desc: 'Защита города ×4.' }, { id: 'explorer', name: 'Исследователь', desc: 'Открыть окрестности города.' }],
    4: [{ id: 'population', name: 'Население', desc: '+3 населения.' }, { id: 'border', name: 'Рост границ', desc: 'Расширить обзор и влияние города.' }],
    5: [{ id: 'park', name: 'Парк', desc: '+250 очков.' }, { id: 'giant', name: 'Гигант', desc: 'Создать сверхотряд.' }]
  };
  const MONUMENTS = [
    { id: 'ALTAR_OF_PEACE', name: 'Алтарь мира', condition: '5 ходов подряд без атак' },
    { id: 'EMPERORS_TOMB', name: 'Гробница императора', condition: 'Устранить другое племя' },
    { id: 'EYE_OF_GOD', name: 'Око бога', condition: 'Исследовать всю карту' },
    { id: 'GATE_OF_POWER', name: 'Врата силы', condition: 'Одновременно иметь 10 отрядов' },
    { id: 'GRAND_BAZAAR', name: 'Большой базар', condition: 'Связать со столицей 5 городов' },
    { id: 'HOLY_HYMN', name: 'Священный гимн', condition: 'Построить все типы храмов' },
    { id: 'TOWER_OF_WISDOM', name: 'Башня мудрости', condition: 'Изучить все технологии' }
  ];

  function makeRng(seed) {
    let s = (Number(seed) || Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function inBounds(state, x, y) { return Number.isInteger(x) && Number.isInteger(y) && y >= 0 && x >= 0 && y < state.grid.length && x < state.grid[0].length; }
  function tileAt(state, x, y) { return inBounds(state, x, y) ? state.grid[y][x] : null; }
  function playerById(state, id) { return state.players.find(p => p.id === Number(id)); }
  function unitDef(unitOrType) { if (unitOrType && typeof unitOrType === 'object' && unitOrType.atk !== undefined && unitOrType.hp !== undefined) return unitOrType; return UNITS[typeof unitOrType === 'string' ? unitOrType : unitOrType && unitOrType.type] || UNITS.WARRIOR; }
  function hasTech(player, techId) { return !!player && player.techs.includes(techId); }
  function citiesOf(state, playerId) { const out = []; for (const row of state.grid) for (const tile of row) if (tile.city && tile.city.owner === playerId) out.push(tile); return out; }
  function unitsOf(state, playerId) { const out = []; for (const row of state.grid) for (const tile of row) if (tile.unit && tile.unit.owner === playerId) out.push({ tile, unit: tile.unit }); return out; }
  function cityAt(state, cityId) { for (const row of state.grid) for (const tile of row) if (tile.city && tile.city.id === cityId) return tile; return null; }
  function chebyshev(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function neighbors(state, x, y, diagonal) {
    const out = []; const dirs = diagonal ? [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] : [[0,-1],[-1,0],[1,0],[0,1]];
    for (const [dx,dy] of dirs) { const t = tileAt(state, x + dx, y + dy); if (t) out.push(t); }
    return out;
  }
  function createTile(x, y, terrain) {
    return { x, y, terrain, resource: null, hasRoad: false, building: null, exploredBy: [], visibleTo: [], city: null, unit: null };
  }
  function chooseSpawn(state, target, used, minGap) {
    let best = null; let bestScore = Infinity;
    for (let y=0; y<state.grid.length; y++) for (let x=0; x<state.grid.length; x++) {
      const t = state.grid[y][x]; if (t.terrain === TERRAIN.OCEAN || t.terrain === TERRAIN.WATER || t.city || t.unit) continue;
      const gap = used.reduce((m,p) => Math.min(m, Math.hypot(p.x-x,p.y-y)), Infinity);
      const score = Math.hypot(target.x-x,target.y-y) + (gap < minGap ? (minGap-gap)*8 : 0);
      if (score < bestScore) { best = t; bestScore = score; }
    }
    return best;
  }
  function makePlayer(id, cfg, isAIDefault) {
    const tribe = TRIBES.find(t => t.id === (cfg.tribe || '').toUpperCase()) || TRIBES[(id-1) % TRIBES.length];
    return {
      id, name: String(cfg.name || (isAIDefault ? `Бот ${id}` : `Игрок ${id}`)).slice(0, 22), tribe: tribe.id, tribeName: tribe.name,
      color: cfg.color || ['#d6a45d','#68b8a5','#a59be7','#e77c75','#80a7d9','#c7b85c','#cc91b5','#8aa76a'][((id-1)%8)],
      isAI: cfg.isAI === undefined ? !!isAIDefault : !!cfg.isAI, connected: cfg.connected !== false,
      aiType: cfg.aiType || 'BALANCED', difficulty: cfg.difficulty || 'NORMAL',
      stars: cfg.isAI && cfg.difficulty === 'HARD' ? 7 : cfg.isAI && cfg.difficulty === 'EASY' ? 3 : 5, spt: 0, score: 0, techs: [...tribe.techs], monuments: [], relations: {}, alive: true,
      cities: 0, unitsBuilt: 0, passiveSpt: 0, turnsWithoutAttack: 0, tribesEliminated: 0, pendingMonuments: []
    };
  }
  function createGame(options) {
    options = options || {};
    const requestedSize = Number(options.mapSize || 16);
    const customRows = Array.isArray(options.customWorld) ? options.customWorld.map(row => String(row)) : null;
    const inferredSize = customRows && customRows.length >= 7 && customRows.length <= 60 && customRows.every(row => row.length === customRows.length) ? customRows.length : requestedSize;
    const n = Math.max(7, Math.min(60, Number.isFinite(inferredSize) ? Math.floor(inferredSize) : 16));
    const mapType = ['ISLANDS','CONTINENT','PANGAEA','LAKES','ARCHIPELAGO','CUSTOM'].includes(options.mapType) ? options.mapType : 'CONTINENT';
    const customTerrain = { '~': TERRAIN.OCEAN, 'w': TERRAIN.WATER, '.': TERRAIN.PLAIN, 'T': TERRAIN.FOREST, '^': TERRAIN.MOUNTAIN, ' ': TERRAIN.PLAIN };
    const configs = Array.isArray(options.players) && options.players.length ? options.players : [
      { name: options.name || 'Игрок 1', tribe: options.tribe || 'IMPERIUS', isAI: false },
      { name: 'Бот 2', tribe: 'BARDUR', isAI: true },
      { name: 'Бот 3', tribe: 'OUMAJI', isAI: true },
      { name: 'Бот 4', tribe: 'XIN_XI', isAI: true }
    ];
    const seed = Number(options.seed) || Math.floor(Math.random() * 0x7fffffff);
    const rng = makeRng(seed);
    const raw = Array.from({ length: n }, () => Array.from({ length: n }, () => rng()));
    let smooth = raw;
    for (let k=0;k<3;k++) {
      const next = Array.from({length:n},()=>Array(n).fill(0));
      for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
        let total=smooth[y][x]*2, count=2;
        for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]) if(y+dy>=0&&x+dx>=0&&y+dy<n&&x+dx<n){total+=smooth[y+dy][x+dx];count++;}
        next[y][x]=total/count;
      }
      smooth=next;
    }
    const players = configs.slice(0,8).map((cfg,i)=>makePlayer(i+1,cfg, i>0));
    const tribeSet = new Set();
    players.forEach((p,i)=> { if(tribeSet.has(p.tribe)){ const next=TRIBES.find(t=>!tribeSet.has(t.id)); if(next){p.tribe=next.id;p.tribeName=next.name;p.techs=[...next.techs];} } tribeSet.add(p.tribe); });
    const state = { turn: 1, activePlayer: players[0].id, gameMode: options.gameMode || 'DOMINATION', scoreToWin: Number(options.scoreToWin)||5000, mapSize: n, mapType, seed, players,
      knownTribesByPlayer: {}, grid: Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=> {
        const v=smooth[y][x]; let terrain;
        if (mapType === 'PANGAEA') {
          if(v < 0.17) terrain=TERRAIN.OCEAN; else if(v < 0.24) terrain=TERRAIN.WATER; else if(v < 0.50) terrain=TERRAIN.PLAIN; else if(v < 0.72) terrain=TERRAIN.FOREST; else if(v < 0.83) terrain=TERRAIN.MOUNTAIN; else terrain=TERRAIN.PLAIN;
        } else if (mapType === 'ISLANDS' || mapType === 'ARCHIPELAGO') {
          if(v < (mapType === 'ARCHIPELAGO' ? 0.43 : 0.36)) terrain=TERRAIN.OCEAN; else if(v < 0.47) terrain=TERRAIN.WATER; else if(v < 0.58) terrain=TERRAIN.PLAIN; else if(v < 0.74) terrain=TERRAIN.FOREST; else if(v < 0.84) terrain=TERRAIN.MOUNTAIN; else terrain=TERRAIN.PLAIN;
        } else {
          if(v < 0.29) terrain=TERRAIN.OCEAN; else if(v < 0.39) terrain=TERRAIN.WATER; else if(v < 0.49) terrain=TERRAIN.PLAIN; else if(v < 0.67) terrain=TERRAIN.FOREST; else if(v < 0.79) terrain=TERRAIN.MOUNTAIN; else terrain=TERRAIN.PLAIN;
        }
        if (customRows && customRows[y] && mapType === 'CUSTOM') terrain = customTerrain[customRows[y][x]] || TERRAIN.PLAIN;
        return createTile(x,y,terrain);
      })), log: [], winner: null, over: false, createdAt: Date.now(), nextUnitId: 1, nextCityId: 1, lastAction: null };
    // Map profiles alter the whole land/water distribution before starting locations are placed.
    if (mapType === 'LAKES') {
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++) if(state.grid[y][x].terrain===TERRAIN.PLAIN && rng()<0.13) state.grid[y][x].terrain=TERRAIN.WATER;
    }
    if (mapType === 'PANGAEA') {
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++) if(state.grid[y][x].terrain===TERRAIN.OCEAN && rng()<0.72) state.grid[y][x].terrain=TERRAIN.PLAIN;
    }
    if (mapType !== 'CUSTOM' && mapType !== 'ARCHIPELAGO') {
      for(let y=1;y<n-1;y++) for(let x=1;x<n-1;x++) if(state.grid[y][x].terrain===TERRAIN.OCEAN && rng()<0.24) state.grid[y][x].terrain=TERRAIN.WATER;
    }
    const used=[]; const minGap=Math.max(3,n/(players.length+1));
    players.forEach((p,i)=> {
      const angle=(Math.PI*2*i/players.length)-Math.PI/2;
      const target={x:Math.round((n-1)/2+Math.cos(angle)*n*0.34),y:Math.round((n-1)/2+Math.sin(angle)*n*0.34)};
      const t=chooseSpawn(state,target,used,minGap) || state.grid[Math.max(0,Math.min(n-1,target.y))][Math.max(0,Math.min(n-1,target.x))];
      if(!t) return;
      t.terrain=TERRAIN.PLAIN; t.resource=null;
      const tribe=TRIBES.find(x=>x.id===p.tribe);
      if(tribe && tribe.terrain==='MOUNTAIN') for(const nb of neighbors(state,t.x,t.y,true)) if(rng()<0.3) nb.terrain=TERRAIN.MOUNTAIN;
      if(tribe && tribe.terrain==='FOREST') for(const nb of neighbors(state,t.x,t.y,true)) if(rng()<0.4) nb.terrain=TERRAIN.FOREST;
      if(tribe && tribe.terrain==='WATER') for(const nb of neighbors(state,t.x,t.y,true)) if(rng()<0.25) nb.terrain=TERRAIN.WATER;
      const level=tribe && tribe.level ? tribe.level : 1;
      t.city={id:`city_${state.nextCityId++}`,owner:p.id,level,population:0,hasWall:false,underSiegeBy:null,capital:true,bonusSpt:0,bonusRange:0,pendingLevelUp:false,connectedToCapital:true};
      t.unit={id:`u_${state.nextUnitId++}`,type:tribe && tribe.swordsman?'SWORDSMAN':'WARRIOR',owner:p.id,hp:tribe&&tribe.swordsman?15:10,maxHp:tribe&&tribe.swordsman?15:10,movedThisTurn:false,attackedThisTurn:false,statusEffects:[],homeCityId:t.city.id};
      if (p.tribe==='LUXIDOOR') { p.stars=7; t.city.population=1; }
      used.push({x:t.x,y:t.y});
    });
    // Scatter neutral settlements to create early objectives.
    const neutralCount=Math.max(2,Math.floor(n/5));
    for(let i=0;i<neutralCount;i++) {
      const target={x:Math.floor(rng()*n),y:Math.floor(rng()*n)};
      const t=chooseSpawn(state,target,used,2.5);
      if(t && !t.city && !t.unit) { t.city={id:`city_${state.nextCityId++}`,owner:0,level:1,population:0,hasWall:false,underSiegeBy:null,capital:false,bonusSpt:0,bonusRange:0,pendingLevelUp:false,connectedToCapital:false}; used.push({x:t.x,y:t.y}); }
    }
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
      const t=state.grid[y][x]; const r=rng();
      if(t.city) continue;
      if(t.terrain===TERRAIN.PLAIN && r<0.14) t.resource = r<0.055?RESOURCE.FRUIT:(r<0.105?RESOURCE.CROP:RESOURCE.FRUIT);
      else if(t.terrain===TERRAIN.FOREST && r<0.15) t.resource=RESOURCE.ANIMAL;
      else if(t.terrain===TERRAIN.MOUNTAIN && r<0.14) t.resource=RESOURCE.ORE;
      else if(t.terrain===TERRAIN.OCEAN && r<0.035) t.resource=RESOURCE.RUINS;
      else if((t.terrain===TERRAIN.WATER || t.terrain===TERRAIN.OCEAN) && r<0.13) t.resource=r<0.02?RESOURCE.WHALE:RESOURCE.FISH;
    }
    for(const p of players) { const cs=citiesOf(state,p.id); p.cities=cs.length; p.spt=cs.reduce((sum,t)=>sum+cityYield(t.city),0); p.score=100*p.cities; }
    recomputeVisibility(state);
    addLog(state, `Мир создан: ${n}×${n}, ${players.length} участников.`);
    return state;
  }
  function addLog(state, text, playerId) {
    state.log.push({turn:state.turn,playerId:playerId||state.activePlayer,text:String(text),id:`log_${state.log.length+1}`});
    if(state.log.length>120) state.log=state.log.slice(-120);
  }
  function recomputeVisibility(state) {
    for(const row of state.grid) for(const t of row) t.visibleTo=[];
    for(const p of state.players) {
      const sources=[];
      for(const row of state.grid) for(const t of row) {
        if((t.unit&&t.unit.owner===p.id) || (t.city&&t.city.owner===p.id)) {
          let r=1;
          if(t.terrain===TERRAIN.MOUNTAIN) r+=2;
          if(t.city&&t.city.bonusRange) r+=t.city.bonusRange;
          sources.push({x:t.x,y:t.y,r});
        }
      }
      for(const s of sources) for(let y=Math.max(0,s.y-s.r);y<=Math.min(state.mapSize-1,s.y+s.r);y++) for(let x=Math.max(0,s.x-s.r);x<=Math.min(state.mapSize-1,s.x+s.r);x++) {
        const t=state.grid[y][x]; if(Math.max(Math.abs(x-s.x),Math.abs(y-s.y))<=s.r) { if(!t.exploredBy.includes(p.id)) t.exploredBy.push(p.id); if(!t.visibleTo.includes(p.id)) t.visibleTo.push(p.id); }
      }
    }
    if (!state.knownTribesByPlayer) state.knownTribesByPlayer = {};
    for (const viewer of state.players) {
      const known = new Set(state.knownTribesByPlayer[viewer.id] || [viewer.id]); known.add(viewer.id);
      for (const row of state.grid) for (const t of row) {
        if (!t.visibleTo.includes(viewer.id)) continue;
        const owner = t.unit?.owner || (t.city && t.city.owner > 0 ? t.city.owner : 0);
        if (owner && owner !== viewer.id) known.add(owner);
      }
      state.knownTribesByPlayer[viewer.id] = [...known];
    }
  }
  function cityYield(city) { return Number(city.level || 1) + Number(city.bonusSpt || 0); }
  function recalcEconomy(state, player) {
    const cities=citiesOf(state,player.id); player.cities=cities.length;
    player.spt=cities.reduce((s,t)=>s+cityYield(t.city),0)+Number(player.passiveSpt||0);
    for(const row of state.grid) for(const t of row) if(t.building) {
      if(t.building.type==='EMBASSY') { if(t.building.owner===player.id) player.spt+=2; if(t.city&&t.city.owner===player.id) player.spt+=2; }
      if(t.building.type==='CUSTOM_HOUSE'&&t.building.owner===player.id) player.spt+=2*neighbors(state,t.x,t.y,true).filter(n=>n.building&&n.building.type==='PORT').length;
    }
  }
  function countUnitsForCity(state, cityId) { let n=0; for(const row of state.grid) for(const t of row) if(t.unit&&t.unit.homeCityId===cityId&&!unitDef(t.unit).giant) n++; return n; }
  function playerUnitCount(state, playerId, includeGiants) { return unitsOf(state,playerId).filter(o=>includeGiants||!unitDef(o.unit).giant).length; }
  function waterPathBetween(state, a, b) {
    const isWater=t=>t.terrain===TERRAIN.WATER||t.terrain===TERRAIN.OCEAN;
    const starts=neighbors(state,a.x,a.y,true).filter(isWater); const goals=new Set(neighbors(state,b.x,b.y,true).filter(isWater).map(t=>`${t.x},${t.y}`));
    const queue=starts.slice(), seen=new Set(queue.map(t=>`${t.x},${t.y}`));
    for(let i=0;i<queue.length;i++) { const t=queue[i], key=`${t.x},${t.y}`; if(goals.has(key)) return true; for(const n of neighbors(state,t.x,t.y,true)) { const k=`${n.x},${n.y}`; if(isWater(n)&&!seen.has(k)){seen.add(k);queue.push(n);} } }
    return false;
  }
  function updateCapitalConnections(state, playerId) {
    const cities=citiesOf(state,playerId); const capital=cities.find(t=>t.city.capital); if(!capital) return;
    const roads=[]; for(const row of state.grid) for(const t of row) if(t.hasRoad) roads.push(t);
    const roadSet=new Set(roads.map(t=>`${t.x},${t.y}`)); const queue=[]; const seen=new Set();
    if(capital.hasRoad) { queue.push(capital); seen.add(`${capital.x},${capital.y}`); }
    for(const n of neighbors(state,capital.x,capital.y,true)) if(n.hasRoad&&!seen.has(`${n.x},${n.y}`)){queue.push(n);seen.add(`${n.x},${n.y}`);}
    for(let i=0;i<queue.length;i++) for(const n of neighbors(state,queue[i].x,queue[i].y,true)) if(n.hasRoad&&!seen.has(`${n.x},${n.y}`)){queue.push(n);seen.add(`${n.x},${n.y}`);}
    for(const cityTile of cities) {
      if(cityTile.city.capital) { cityTile.city.connectedToCapital=true; continue; }
      const roadConnected=seen.has(`${cityTile.x},${cityTile.y}`)||neighbors(state,cityTile.x,cityTile.y,true).some(n=>roadSet.has(`${n.x},${n.y}`));
      const portConnected=capital.building&&capital.building.type==='PORT'&&cityTile.building&&cityTile.building.type==='PORT'&&waterPathBetween(state,capital,cityTile);
      if((roadConnected||portConnected)&&!cityTile.city.connectedToCapital) {
        cityTile.city.connectedToCapital=true;
        addPopulation(state,cityTile,1); addPopulation(state,capital,1);
        addLog(state,`Город ${cityTile.x},${cityTile.y} соединён со столицей: +1 население обоим городам.`,playerId);
      }
    }
  }
  function checkMonuments(state, player) {
    if(!player||!player.alive) return;
    const owned=[...(player.monuments||[]),...(player.pendingMonuments||[]).map(m=>m.id)];
    const cities=citiesOf(state,player.id);
    const allExplored=state.grid.every(row=>row.every(t=>t.exploredBy.includes(player.id)));
    const temples=new Set();
    for(const row of state.grid) for(const t of row) if(t.building&&t.building.owner===player.id) {
      if(['MOUNTAIN_TEMPLE','FOREST_TEMPLE','WATER_TEMPLE'].includes(t.building.type)) temples.add(t.building.type);
    }
    const connectedCount=cities.filter(t=>t.city.capital||t.city.connectedToCapital).length;
    const tests={
      ALTAR_OF_PEACE:(player.turnsWithoutAttack||0)>=5,
      EMPERORS_TOMB:(player.tribesEliminated||0)>=1,
      EYE_OF_GOD:allExplored,
      GATE_OF_POWER:playerUnitCount(state,player.id,true)>=10,
      GRAND_BAZAAR:cities.filter(t=>!t.city.capital&&t.city.connectedToCapital).length>=5,
      HOLY_HYMN:['MOUNTAIN_TEMPLE','FOREST_TEMPLE','WATER_TEMPLE'].every(t=>temples.has(t)),
      TOWER_OF_WISDOM:player.techs.length>=TECHS.length
    };
    for(const monument of MONUMENTS) if(tests[monument.id]&&!owned.includes(monument.id)) {
      if(!player.pendingMonuments) player.pendingMonuments=[];
      player.pendingMonuments.push({id:monument.id,name:monument.name});
      addLog(state,`${monument.name}: условие выполнено. Выберите город для награды.`,player.id);
      owned.push(monument.id);
    }
  }
  function techCost(state, player, techId) { const tech=TECHS.find(t=>t.id===techId); if(!tech) return Infinity; const cities=Math.max(1,citiesOf(state,player.id).length); const base=({1:5,2:6,3:7})[tech.tier]*cities; return hasTech(player,'PHILOSOPHY') ? Math.ceil(base*0.67) : base; }
  function techAvailable(player, techId) { const tech=TECHS.find(t=>t.id===techId); if(!tech||hasTech(player,techId)) return false; return (tech.req||[]).every(r=>hasTech(player,r)); }
  function unitCanUseTerrain(state, unit, t, player) {
    const def=unitDef(unit);
    if(def.domain==='naval') {
      if(t.terrain===TERRAIN.WATER) return hasTech(player,'SAILING');
      if(t.terrain===TERRAIN.OCEAN) return hasTech(player,'NAVIGATION');
      return hasTech(player,'NAVIGATION') && t.terrain===TERRAIN.PLAIN && t.building && t.building.type==='PORT';
    }
    if(t.terrain===TERRAIN.OCEAN) return false;
    if(t.terrain===TERRAIN.WATER) return hasTech(player,'SAILING') && def.domain==='naval';
    if(t.terrain===TERRAIN.MOUNTAIN && !hasTech(player,'CLIMBING')) return false;
    return true;
  }
  function tileMoveCost(t, player) {
    if(t.hasRoad) return 0.5;
    if(t.terrain===TERRAIN.FOREST || t.terrain===TERRAIN.MOUNTAIN) return 99;
    if(t.terrain===TERRAIN.WATER || t.terrain===TERRAIN.OCEAN) return 1;
    return 1;
  }
  function findPath(state, unitTile, unit, targetTile, player) {
    if(!unitTile||!targetTile||unitTile===targetTile) return null;
    const def=unitDef(unit); const budget=def.move; const queue=[{tile:unitTile,cost:0,path:[]}]; const best=new Map([[`${unitTile.x},${unitTile.y}`,0]]);
    while(queue.length) {
      queue.sort((a,b)=>a.cost-b.cost); const cur=queue.shift();
      if(cur.tile.x===targetTile.x&&cur.tile.y===targetTile.y) return cur.path;
      for(const nb of neighbors(state,cur.tile.x,cur.tile.y,true)) {
        if(nb!==targetTile && nb.unit) continue;
        if(nb.unit && nb.unit.owner!==player.id) continue;
        if(nb.city && nb.city.owner!==0 && nb.city.owner!==player.id && nb.unit==null) { /* enemy cities may be entered under siege */ }
        if(!unitCanUseTerrain(state,unit,nb,player)) continue;
        const stopsOnEntry = nb.terrain===TERRAIN.FOREST || nb.terrain===TERRAIN.MOUNTAIN;
        const step=tileMoveCost(nb,player);
        const cost=stopsOnEntry ? (cur.cost < budget ? budget : Infinity) : cur.cost+step;
        if(cost>budget) continue;
        const key=`${nb.x},${nb.y}`; if(best.has(key)&&best.get(key)<=cost) continue;
        best.set(key,cost); queue.push({tile:nb,cost,path:cur.path.concat([{x:nb.x,y:nb.y}])});
      }
    }
    return null;
  }
  function defenseBonus(tile, player) {
    if(tile.city&&tile.city.hasWall) return 4;
    if(tile.terrain===TERRAIN.FOREST||tile.terrain===TERRAIN.MOUNTAIN) return 1.5;
    if((tile.terrain===TERRAIN.WATER||tile.terrain===TERRAIN.OCEAN)&&hasTech(player,'AQUATISM')) return 1.5;
    return 1;
  }
  function calculateDamage(attacker, defender, defenderTile, defenderOwner) {
    const a=unitDef(attacker), d=unitDef(defender);
    const af=a.atk*(attacker.hp/attacker.maxHp);
    const df=d.def*(defender.hp/defender.maxHp)*defenseBonus(defenderTile,defenderOwner);
    if(af<=0) return 0;
    const tf=af+df;
    return Math.max(1,Math.round((af/tf)*a.atk*4.5));
  }
  function relationBetween(a,b) { return a.relations && a.relations[b] ? a.relations[b].type : 'NEUTRAL'; }
  function canAttackFromTo(state, fromTile, toTile, attacker, player) {
    if(!fromTile||!toTile||!toTile.unit||toTile.unit.owner===player.id||attacker.attackedThisTurn) return false;
    const relation=player.relations&&player.relations[toTile.unit.owner];
    if(relation&&relation.type==='PEACE') return false;
    if(relation&&relation.breachUntil&&relation.breachUntil>=state.turn) return false;
    return chebyshev(fromTile,toTile)<=unitDef(attacker).range;
  }
  function validateActive(state, playerId) {
    if(state.over) throw new Error('Игра уже завершена.');
    if(Number(state.activePlayer)!==Number(playerId)) throw new Error('Сейчас ход другого игрока.');
    const p=playerById(state,playerId); if(!p||!p.alive) throw new Error('Игрок недоступен.'); return p;
  }
  function ensureTile(state, x, y) { const t=tileAt(state,Number(x),Number(y)); if(!t) throw new Error('Клетка вне карты.'); return t; }
  function popCheck(cityTile) { const c=cityTile.city; if(c && c.population >= c.level+1) c.pendingLevelUp=true; }
  function addPopulation(state, cityTile, amount) { if(!cityTile||!cityTile.city) return; cityTile.city.population+=amount; popCheck(cityTile); const p=playerById(state,cityTile.city.owner); if(p) p.score+=amount*10; }
  function closestOwnedCity(state, playerId, t, maxDist) {
    let best=null,dist=Infinity; for(const c of citiesOf(state,playerId)) { const d=chebyshev(c,t); if(d<=maxDist&&d<dist){best=c;dist=d;} } return best;
  }
  function markMovedForZoC(state, unit, destTile) {
    for(const nb of neighbors(state,destTile.x,destTile.y,true)) if(nb.unit&&nb.unit.owner!==unit.owner&&relationBetween(playerById(state,unit.owner),nb.unit.owner)!=='PEACE') { unit.movedThisTurn=true; return true; }
    return false;
  }
  function allCityOwnersAlive(state) { return state.players.filter(p=>p.alive && citiesOf(state,p.id).length>0); }
  function checkVictory(state) {
    const alive=allCityOwnersAlive(state);
    if(state.gameMode==='SCORE') {
      const ranked=state.players.filter(p=>p.alive).slice().sort((a,b)=>b.score-a.score);
      if(ranked[0] && ranked[0].score>=Number(state.scoreToWin||5000)) { state.over=true; state.winner=ranked[0].id; addLog(state,`${ranked[0].name} побеждает по очкам!`); return; }
    }
    if(alive.length<=1 && state.players.length>1) { state.over=true; state.winner=alive[0]?alive[0].id:null; addLog(state,state.winner?`${playerById(state,state.winner).name} побеждает!`:'Игра завершена без победителя.'); }
  }
  function performAction(state, playerId, action) {
    const player=validateActive(state,playerId); if(!action||!action.type) throw new Error('Не указано действие.');
    const type=String(action.type);
    if(type==='research') {
      const tech=TECHS.find(t=>t.id===action.techId); if(!tech) throw new Error('Неизвестная технология.');
      if(!techAvailable(player,tech.id)) throw new Error('Технология пока недоступна.');
      const cost=techCost(state,player,tech.id); if(player.stars<cost) throw new Error(`Нужно ${cost} звёзд.`);
      player.stars-=cost; player.techs.push(tech.id); player.score+=50;
      addLog(state,`${player.name} изучает «${tech.name}».`,player.id);
      if(tech.id==='PHILOSOPHY') addLog(state,'Будущие технологии стоят на 33% дешевле.',player.id);
    } else if(type==='harvest') {
      const t=ensureTile(state,action.x,action.y); if(!t.resource) throw new Error('На клетке нет ресурса.');
      const info=RESOURCE_INFO[t.resource]; if(!info||!hasTech(player,info.tech)) throw new Error('Нужна соответствующая технология.');
      const nearOwnedUnit=t.resource===RESOURCE.RUINS&&unitsOf(state,player.id).some(o=>chebyshev(o.tile,t)<=1&&unitDef(o.unit).domain==='naval');
      if(!closestOwnedCity(state,player.id,t,3) && !(t.city&&t.city.owner===player.id) && !nearOwnedUnit) throw new Error('Ресурс должен быть рядом с вашим городом или морским отрядом.');
      if(info.stars) player.stars+=info.stars;
      if(info.pop) addPopulation(state,closestOwnedCity(state,player.id,t,3)||t,info.pop);
      addLog(state,`${player.name}: ${info.label} ${info.pop?`(+${info.pop} населения)`:''}${info.stars?` (+${info.stars}★)`:''}.`,player.id);
      t.resource=null; player.score+=info.pop*20+(info.stars||0)*2;
    } else if(type==='move') {
      const from=ensureTile(state,action.x,action.y), to=ensureTile(state,action.toX,action.toY), unit=from.unit;
      if(!unit||unit.owner!==player.id) throw new Error('Выберите собственный отряд.');
      if(unit.movedThisTurn) throw new Error('Этот отряд уже двигался.');
      if(to.unit) throw new Error('Клетка занята отрядом.');
      const path=findPath(state,from,unit,to,player); if(!path||path.length===0) throw new Error('Клетка недоступна в пределах движения.');
      if(unit.attackedThisTurn && !unitDef(unit).escape) throw new Error('Этот отряд не может двигаться после атаки.');
      if(unitDef(unit).indirect && unit.attackedThisTurn) throw new Error('Эта осадная единица не может двигаться после атаки.');
      from.unit=null; to.unit=unit;
      const zoC=markMovedForZoC(state,unit,to); unit.movedThisTurn=true;
      if(to.city && to.city.owner!==player.id) { to.city.underSiegeBy=player.id; addLog(state,`${player.name} осаждает ${to.city.capital?'столицу':'город'} на клетке ${to.x},${to.y}.`,player.id); }
      if(unit.type==='CLOAK') unit.hidden=true;
      addLog(state,`${player.name}: ${unitDef(unit).name} перемещён на ${to.x},${to.y}${zoC?' (зона контроля)':''}.`,player.id);
      recomputeVisibility(state);
    } else if(type==='attack') {
      const from=ensureTile(state,action.x,action.y),to=ensureTile(state,action.toX,action.toY), attacker=from.unit;
      if(!attacker||attacker.owner!==player.id) throw new Error('Выберите собственный отряд.');
      if(!canAttackFromTo(state,from,to,attacker,player)) throw new Error('Цель вне радиуса атаки или защищена перемирием.');
      if(unitDef(attacker).indirect && attacker.movedThisTurn) throw new Error('Осадная единица не может двигаться и атаковать в один ход.');
      if(attacker.type==='MIND_BENDER') throw new Error('Менталист использует специальное действие рядом с целью.');
      const defender=to.unit, defenderOwner=playerById(state,defender.owner);
      const damage=calculateDamage(attacker,defender,to,defenderOwner); defender.hp-=damage; attacker.attackedThisTurn=true; player.turnsWithoutAttack=0;
      let text=`${player.name}: ${unitDef(attacker).name} наносит ${damage} урона.`;
      if(defender.hp<=0) { to.unit=null; text+=` ${defenderOwner.name} теряет отряд.`; if(unitDef(attacker).persist) { from.unit=null; to.unit=attacker; attacker.movedThisTurn=true; attacker.attackedThisTurn=false; } }
      else if(chebyshev(from,to)<=unitDef(defender).range && unitDef(defender).atk>0) {
        const retaliation=calculateDamage(defender,attacker,from,player); attacker.hp-=retaliation; text+=` Ответный удар: ${retaliation}.`;
        if(attacker.hp<=0) { from.unit=null; text+=` Ваш отряд уничтожен.`; }
      }
      addLog(state,text,player.id); player.score+=damage*2;
      if(!to.unit && to.city && to.city.owner!==player.id) to.city.underSiegeBy=player.id;
      for(const p of state.players) if(p.id!==player.id && p.id===defenderOwner.id) p.score=Math.max(0,p.score-10);
      recomputeVisibility(state); checkVictory(state);
    } else if(type==='train') {
      const t=ensureTile(state,action.x,action.y); if(!t.city||t.city.owner!==player.id) throw new Error('Обучать отряды можно только в своём городе.');
      const unitId=String(action.unitType||'WARRIOR').toUpperCase(), def=UNITS[unitId]; if(!def||unitId==='GIANT'||unitId==='DAGGER'||unitId==='JUGGERNAUT') throw new Error('Этот отряд не обучается обычным способом.');
      if(def.req&&!hasTech(player,def.req)) throw new Error('Нужна соответствующая технология.');
      if(def.domain==='naval'&&(!hasTech(player,'SAILING')||!t.building||t.building.type!=='PORT')) throw new Error('Морские отряды обучаются в порту после изучения мореплавания.');
      if(player.stars<def.cost) throw new Error(`Нужно ${def.cost} звёзд.`);
      if(countUnitsForCity(state,t.city.id)>=t.city.level) throw new Error('Лимит отрядов этого города исчерпан.');
      const available=neighbors(state,t.x,t.y,true).find(n=>!n.unit&&(!n.city||n.city.owner===player.id)&&unitCanUseTerrain(state,def,n,player));
      if(!available) throw new Error('Нет свободной клетки рядом с городом.');
      player.stars-=def.cost;
      available.unit={id:`u_${state.nextUnitId++}`,type:unitId,owner:player.id,hp:def.hp,maxHp:def.hp,movedThisTurn:true,attackedThisTurn:true,statusEffects:[],homeCityId:t.city.id};
      player.unitsBuilt++; player.score+=15; addLog(state,`${player.name} обучает: ${def.name}.`,player.id); recomputeVisibility(state);
    } else if(type==='build') {
      const t=ensureTile(state,action.x,action.y); const build=String(action.building||'').toUpperCase();
      const embassyTarget=build==='EMBASSY'&&t.city&&t.city.owner!==player.id&&t.city.capital;
      if(!embassyTarget&&!closestOwnedCity(state,player.id,t,3)&&!(t.city&&t.city.owner===player.id)) throw new Error('Строительство возможно только рядом с вашим городом.');
      if(t.unit&&t.unit.owner!==player.id) throw new Error('На клетке вражеский отряд.');
      if(build==='ROAD') { if(!hasTech(player,'ROADS')) throw new Error('Нужна технология «Дороги».'); if(t.hasRoad) throw new Error('Здесь уже есть дорога.'); if(player.stars<1) throw new Error('Нужно 1★.'); player.stars-=1; t.hasRoad=true; }
      else if(build==='FARM') { if(!hasTech(player,'FARMING')||t.terrain!==TERRAIN.PLAIN) throw new Error('Нужны земледелие и равнина.'); if(player.stars<5) throw new Error('Нужно 5★.'); player.stars-=5; t.building={type:'FARM',owner:player.id}; addPopulation(state,closestOwnedCity(state,player.id,t,3),2); }
      else if(build==='MINE') { if(!hasTech(player,'MINING')||t.resource!==RESOURCE.ORE) throw new Error('Нужны добыча руды и месторождение.'); if(player.stars<5) throw new Error('Нужно 5★.'); player.stars-=5; t.building={type:'MINE',owner:player.id}; addPopulation(state,closestOwnedCity(state,player.id,t,3),2); t.resource=null; }
      else if(build==='HUT') { if(!hasTech(player,'FORESTRY')||t.terrain!==TERRAIN.FOREST) throw new Error('Нужны лесное дело и лес.'); if(player.stars<3) throw new Error('Нужно 3★.'); player.stars-=3; t.building={type:'HUT',owner:player.id}; addPopulation(state,closestOwnedCity(state,player.id,t,3),1); }
      else if(build==='PORT') { if(!hasTech(player,'SAILING')||!(t.city&&t.city.owner===player.id)||!neighbors(state,t.x,t.y,true).some(n=>n.terrain===TERRAIN.WATER||n.terrain===TERRAIN.OCEAN)) throw new Error('Нужны мореплавание, свой прибрежный город.'); if(player.stars<10) throw new Error('Нужно 10★.'); player.stars-=10; t.building={type:'PORT',owner:player.id}; updateCapitalConnections(state,player.id); }
      else if(build==='TEMPLE') { if(!hasTech(player,'MEDITATION')||t.terrain!==TERRAIN.MOUNTAIN) throw new Error('Нужны медитация и гора.'); if(player.stars<10) throw new Error('Нужно 10★.'); player.stars-=10; t.building={type:'MOUNTAIN_TEMPLE',owner:player.id}; addPopulation(state,closestOwnedCity(state,player.id,t,3),1); }
      else if(build==='FOREST_TEMPLE') { if(!hasTech(player,'SPIRITUALISM')||t.terrain!==TERRAIN.FOREST) throw new Error('Нужны спиритуализм и лес.'); if(player.stars<10) throw new Error('Нужно 10★.'); player.stars-=10; t.building={type:'FOREST_TEMPLE',owner:player.id}; }
      else if(build==='WATER_TEMPLE') { if(!hasTech(player,'AQUATISM')||!(t.terrain===TERRAIN.WATER||t.terrain===TERRAIN.OCEAN)) throw new Error('Нужны акватизм и водная клетка.'); if(player.stars<10) throw new Error('Нужно 10★.'); player.stars-=10; t.building={type:'WATER_TEMPLE',owner:player.id}; }
      else if(build==='SAWMILL') { if(!hasTech(player,'MATHEMATICS')||t.building) throw new Error('Нужны математика и свободная клетка.'); if(player.stars<5) throw new Error('Нужно 5★.'); player.stars-=5; t.building={type:'SAWMILL',owner:player.id}; const huts=neighbors(state,t.x,t.y,true).filter(n=>n.building&&n.building.type==='HUT'&&n.building.owner===player.id).length; if(huts) addPopulation(state,closestOwnedCity(state,player.id,t,3),huts); }
      else if(build==='FORGE') { if(!hasTech(player,'SMITHING')||t.building) throw new Error('Нужны кузнечное дело и свободная клетка.'); if(player.stars<5) throw new Error('Нужно 5★.'); player.stars-=5; t.building={type:'FORGE',owner:player.id}; const mines=neighbors(state,t.x,t.y,true).filter(n=>n.building&&n.building.type==='MINE'&&n.building.owner===player.id).length; if(mines) addPopulation(state,closestOwnedCity(state,player.id,t,3),mines*2); }
      else if(build==='CUSTOM_HOUSE') { if(!hasTech(player,'TRADE')||t.building) throw new Error('Нужны торговля и свободная клетка.'); if(player.stars<5) throw new Error('Нужно 5★.'); player.stars-=5; t.building={type:'CUSTOM_HOUSE',owner:player.id}; }
      else if(build==='EMBASSY') { if(!hasTech(player,'DIPLOMACY')||!embassyTarget) throw new Error('Нужно знание дипломатии и чужая столица.'); if(player.stars<5) throw new Error('Нужно 5★.'); player.stars-=5; t.building={type:'EMBASSY',owner:player.id}; }
      else if(build==='CLEAR_FOREST') { if(!hasTech(player,'FORESTRY')||t.terrain!==TERRAIN.FOREST) throw new Error('Нужны лесное дело и лес.'); t.terrain=TERRAIN.PLAIN; t.resource=null; player.stars+=2; }
      else if(build==='BURN_FOREST') { if(!hasTech(player,'CHIVALRY')||t.terrain!==TERRAIN.FOREST) throw new Error('Нужны рыцарство и лес.'); t.terrain=TERRAIN.PLAIN; t.resource=null; }
      else if(build==='FOREST') { if(!hasTech(player,'SPIRITUALISM')||t.terrain!==TERRAIN.PLAIN) throw new Error('Нужны спиритуализм и равнина.'); if(player.stars<3) throw new Error('Нужно 3★.'); player.stars-=3; t.terrain=TERRAIN.FOREST; }
      else throw new Error('Неизвестное сооружение.');
      player.score+=10; addLog(state,`${player.name}: построено ${({ROAD:'дорога',FARM:'ферма',MINE:'шахта',HUT:'лесная хижина',PORT:'порт',TEMPLE:'горный храм',FOREST_TEMPLE:'лесной храм',WATER_TEMPLE:'водный храм',SAWMILL:'лесопилка',FORGE:'кузница',CUSTOM_HOUSE:'торговый дом',EMBASSY:'посольство',CLEAR_FOREST:'расчищен лес',BURN_FOREST:'лес выжжен',FOREST:'посажен лес'})[build]||build}.`,player.id); if(build==='ROAD') updateCapitalConnections(state,player.id); recalcEconomy(state,player); recomputeVisibility(state);
    } else if(type==='upgradeCity') {
      const t=ensureTile(state,action.x,action.y); const c=t.city;
      if(!c||c.owner!==player.id) throw new Error('Это не ваш город.');
      if(!c.pendingLevelUp||c.population<c.level+1) throw new Error('Город пока не готов к улучшению.');
      const newLevel=c.level+1, valid=(LEVEL_BONUSES[newLevel]||LEVEL_BONUSES[5]).some(b=>b.id===action.bonus); if(!valid) throw new Error('Выберите бонус для нового уровня.');
      c.population-=c.level+1; c.level=newLevel; c.pendingLevelUp=false;
      const bonus=action.bonus;
      if(bonus==='stars') player.stars+=5;
      if(bonus==='workshop') c.bonusSpt=(c.bonusSpt||0)+1;
      if(bonus==='wall') c.hasWall=true;
      if(bonus==='explorer') { c.bonusRange=(c.bonusRange||0)+2; recomputeVisibility(state); }
      if(bonus==='population') c.population+=3;
      if(bonus==='border') c.bonusRange=(c.bonusRange||0)+1;
      if(bonus==='park') player.score+=250;
      if(bonus==='giant') {
        const spot=neighbors(state,t.x,t.y,true).find(n=>!n.unit&&n.terrain!==TERRAIN.WATER&&n.terrain!==TERRAIN.OCEAN);
        if(spot) spot.unit={id:`u_${state.nextUnitId++}`,type:'GIANT',owner:player.id,hp:40,maxHp:40,movedThisTurn:true,attackedThisTurn:true,statusEffects:[],homeCityId:c.id};
        else player.stars+=5;
      }
      popCheck(t); addLog(state,`${player.name}: город ${t.x},${t.y} вырос до уровня ${c.level} (${bonus}).`,player.id); recalcEconomy(state,player); recomputeVisibility(state);
    } else if(type==='special') {
      const from=ensureTile(state,action.x,action.y), unit=from.unit; if(!unit||unit.owner!==player.id) throw new Error('Выберите свой отряд.');
      const def=unitDef(unit);
      if(unit.type==='MIND_BENDER') {
        const to=ensureTile(state,action.toX,action.toY); if(!to.unit||to.unit.owner===player.id||chebyshev(from,to)>1) throw new Error('Нужен соседний вражеский отряд.');
        if(hasTech(player,'PHILOSOPHY')&&to.unit.type!=='GIANT') { to.unit.owner=player.id; to.unit.homeCityId=closestOwnedCity(state,player.id,from,10)?.city.id||unit.homeCityId; unit.attackedThisTurn=true; addLog(state,`${player.name} переманивает отряд!`,player.id); }
        else { for(const nb of neighbors(state,from.x,from.y,true)) if(nb.unit&&nb.unit.owner===player.id) nb.unit.hp=Math.min(nb.unit.maxHp,nb.unit.hp+4); unit.attackedThisTurn=true; addLog(state,`${player.name}: менталист лечит союзников.`,player.id); }
      } else if(unit.type==='CLOAK') {
        const to=ensureTile(state,action.toX,action.toY); if(!to.city||to.city.owner===0||to.city.owner===player.id||chebyshev(from,to)>1) throw new Error('Нужен соседний город другого племени.'); if(to.unit) throw new Error('В город нельзя проникнуть, пока вход занят отрядом.');
        to.city.hasWall=false; from.unit=null; to.unit=unit; unit.homeCityId=closestOwnedCity(state,player.id,from,10)?.city.id||unit.homeCityId; unit.attackedThisTurn=true; unit.movedThisTurn=true; unit.hidden=false;
        for(const nb of neighbors(state,to.x,to.y,true)) if(!nb.unit) nb.unit={id:`u_${state.nextUnitId++}`,type:'DAGGER',owner:player.id,hp:10,maxHp:10,movedThisTurn:true,attackedThisTurn:true,statusEffects:[],homeCityId:unit.homeCityId};
        addLog(state,`${player.name}: проникновение! Стена уничтожена, появились кинжалы.`,player.id);
      } else if(unit.type==='RAFT' || unitDef(unit).domain==='naval') {
        const to=ensureTile(state,action.toX,action.toY); if(chebyshev(from,to)!==1||to.unit||!(to.terrain===TERRAIN.PLAIN||to.terrain===TERRAIN.FOREST||to.terrain===TERRAIN.MOUNTAIN)) throw new Error('Высадка возможна на соседнюю свободную сушу.');
        const landType=unit.embarkedType||'WARRIOR'; const d=UNITS[landType]||UNITS.WARRIOR; from.unit=null; to.unit={...unit,type:landType,hp:Math.min(unit.hp,d.hp),maxHp:d.hp,movedThisTurn:true,attackedThisTurn:true}; addLog(state,`${player.name}: высадка на берег.`,player.id);
      } else throw new Error('У этого отряда нет специального действия.');
      recomputeVisibility(state);
    } else if(type==='embark') {
      const t=ensureTile(state,action.x,action.y); if(!hasTech(player,'SAILING')) throw new Error('Нужно мореплавание.'); if(!t.unit||t.unit.owner!==player.id) throw new Error('Выберите свой отряд.'); if(!t.building||t.building.type!=='PORT') throw new Error('Нужен порт.');
      const current=t.unit; if(unitDef(current).domain==='naval') throw new Error('Отряд уже на воде.');
      const ship=UNITS.RAFT; t.unit={...current,embarkedType:current.type,type:'RAFT',hp:Math.min(current.hp,ship.hp),maxHp:ship.hp,movedThisTurn:true,attackedThisTurn:true}; addLog(state,`${player.name}: отряд отправился в плавание.`,player.id);
    } else if(type==='relation') {
      if(!hasTech(player,'DIPLOMACY')) throw new Error('Нужна технология «Дипломатия».');
      const other=playerById(state,Number(action.otherPlayerId)); if(!other||other.id===player.id) throw new Error('Неверный игрок.');
      const rel=String(action.relation||'NEUTRAL').toUpperCase(); if(!['NEUTRAL','PEACE','WAR'].includes(rel)) throw new Error('Неверный тип отношений.');
      if(!player.relations) player.relations={}; if(!other.relations) other.relations={};
      const wasPeace=relationBetween(player,other.id)==='PEACE'; const breachUntil=wasPeace&&rel!=='PEACE'?state.turn+1:0;
      player.relations[other.id]={type:rel,turn:state.turn,breachUntil}; other.relations[player.id]={type:rel,turn:state.turn,breachUntil}; addLog(state,`${player.name} устанавливает отношения с ${other.name}: ${rel}${breachUntil?' (пауза перед нападением)':''}.`,player.id);
    } else if(type==='claimMonument') {
      const monumentId=String(action.monumentId||''); const pending=(player.pendingMonuments||[]).find(m=>m.id===monumentId);
      if(!pending) throw new Error('Эта награда уже получена или ещё не доступна.');
      const cityTile=cityAt(state,String(action.cityId||'')); if(!cityTile||!cityTile.city||cityTile.city.owner!==player.id) throw new Error('Выберите свой город для награды.');
      player.pendingMonuments=player.pendingMonuments.filter(m=>m.id!==monumentId); player.monuments.push(monumentId); addPopulation(state,cityTile,3); player.score+=400;
      addLog(state,`${player.name} получает памятник «${pending.name}»: +3 населения и +400 очков.`,player.id);
    } else if(type==='endTurn') {
      return endTurn(state,playerId);
    } else throw new Error(`Неизвестное действие: ${type}`);
    state.lastAction={type,playerId:Number(playerId),at:Date.now()};
    checkMonuments(state,player);
    return state;
  }
  function resolveSieges(state, playerId) {
    for(const row of state.grid) for(const t of row) if(t.city&&t.city.underSiegeBy===playerId) {
      if(t.unit&&t.unit.owner===playerId) {
        const old=t.city.owner; t.city.owner=playerId; t.city.underSiegeBy=null; t.city.capital=false; t.city.population=0; t.city.pendingLevelUp=false; t.city.connectedToCapital=false;
        t.unit.homeCityId=t.city.id;
        const p=playerById(state,playerId); p.score+=100;
        if(old && old!==playerId) { const oldPlayer=playerById(state,old); if(oldPlayer) { oldPlayer.score=Math.max(0,oldPlayer.score-80); if(citiesOf(state,old).length===0) { oldPlayer.alive=false; p.tribesEliminated=(p.tribesEliminated||0)+1; } } }
        addLog(state,`${p.name} захватывает город на клетке ${t.x},${t.y}.`,playerId);
      } else t.city.underSiegeBy=null;
    }
  }
  function endTurn(state, playerId) {
    const player=validateActive(state,playerId);
    player.turnsWithoutAttack=(player.turnsWithoutAttack||0)+1;
    checkMonuments(state,player);
    const order=state.players; let index=order.findIndex(p=>p.id===player.id); let next=null;
    for(let i=1;i<=order.length;i++) { const cand=order[(index+i)%order.length]; if(cand&&cand.alive&&citiesOf(state,cand.id).length>0) { next=cand; break; } }
    if(!next) { state.over=true; state.winner=player.id; return state; }
    if(next.id<=player.id) state.turn++;
    state.activePlayer=next.id;
    resolveSieges(state,next.id);
    // New turn income and reset for the newly active player.
    recalcEconomy(state,next); next.stars+=next.spt; next.score+=next.spt*5;
    for(const row of state.grid) for(const t of row) if(t.unit&&t.unit.owner===next.id) { t.unit.movedThisTurn=false; t.unit.attackedThisTurn=false; t.unit.hidden=false; }
    addLog(state,`Ход игрока ${next.name}. Получено ${next.spt}★.`,next.id);
    recomputeVisibility(state); checkVictory(state); checkMonuments(state,next);
    return state;
  }
  function legalResearch(state, player) { return TECHS.filter(t=>techAvailable(player,t.id)).map(t=>({...t,cost:techCost(state,player,t.id),affordable:player.stars>=techCost(state,player,t.id)})); }
  function getPlayerView(state, playerId) {
    const p=playerById(state,playerId); if(!p) throw new Error('Игрок не найден.');
    const copy=clone(state);
    const known = new Set((state.knownTribesByPlayer && state.knownTribesByPlayer[playerId]) || [Number(playerId)]);
    for (const other of copy.players) {
      if (other.id !== Number(playerId) && !known.has(other.id)) {
        other.tribe = 'UNKNOWN'; other.tribeName = 'Неизвестное племя'; other.techs = []; other.lore = null;
      }
    }
    for(let y=0;y<copy.grid.length;y++) for(let x=0;x<copy.grid[y].length;x++) {
      const t=copy.grid[y][x]; const original=state.grid[y][x];
      if(!original.exploredBy.includes(Number(playerId))) { t.terrain='UNKNOWN'; t.resource=null; t.hasRoad=false; t.building=null; t.city=null; t.unit=null; }
      else if(!original.visibleTo.includes(Number(playerId))) { t.unit=null; t.city=null; t.visibleTo=[]; }
      // Cloaks stay hidden unless the viewer owns the unit or is adjacent to it.
      if(t.unit&&t.unit.hidden&&t.unit.owner!==Number(playerId)) {
        const adjacent=neighbors(state,x,y,true).some(n=>n.visibleTo.includes(Number(playerId))&&(n.unit&&n.unit.owner===Number(playerId)));
        if(!adjacent) t.unit=null;
      }
    }
    return copy;
  }
  function aiTurn(state, playerId) {
    const p=playerById(state,playerId); if(!p||!p.isAI||state.activePlayer!==p.id||state.over) return state;
    let guard=0;
    const act=(a)=>{ try { performAction(state,p.id,a); return true; } catch(e) { return false; } };
    // Grow the economy first, but prefer technologies that unlock nearby resources.
    while(guard++<4) {
      const available=legalResearch(state,p);
      const wanted=available.find(t=> (t.id==='ORGANIZATION'&&state.grid.flat().some(t=>t.resource===RESOURCE.FRUIT)) || (t.id==='HUNTING'&&state.grid.flat().some(t=>t.resource===RESOURCE.ANIMAL)) || (t.id==='FISHING'&&state.grid.flat().some(t=>t.resource===RESOURCE.FISH)) || (t.id==='CLIMBING'&&state.grid.flat().some(t=>t.terrain===TERRAIN.MOUNTAIN)));
      const tech=wanted||available.find(t=>t.affordable);
      if(!tech||!tech.affordable||!act({type:'research',techId:tech.id})) break;
    }
    // Improve a ready city.
    for(const ct of citiesOf(state,p.id)) if(ct.city.pendingLevelUp) {
      const level=Math.min(5,ct.city.level+1); const opts=LEVEL_BONUSES[level]||LEVEL_BONUSES[5]; const bonus=opts.find(b=>b.id==='workshop')||opts.find(b=>b.id==='wall')||opts[0]; act({type:'upgradeCity',x:ct.x,y:ct.y,bonus:bonus.id});
    }
    // Gather resources around owned cities.
    for(let y=0;y<state.mapSize;y++) for(let x=0;x<state.mapSize;x++) {
      const t=state.grid[y][x]; const ri=t.resource&&RESOURCE_INFO[t.resource]; if(ri&&hasTech(p,ri.tech)&&closestOwnedCity(state,p.id,t,3)) act({type:'harvest',x,y});
    }
    // Attack with all ready units, then move toward useful objectives.
    for(const item of unitsOf(state,p.id)) {
      let from=item.tile, u=from.unit;
      if(!u||u.movedThisTurn||state.over) continue;
      let target=null; let best=-1;
      for(let y=0;y<state.mapSize;y++) for(let x=0;x<state.mapSize;x++) { const t=state.grid[y][x]; if(t.unit&&t.unit.owner!==p.id&&canAttackFromTo(state,from,t,u,p)) { const score=unitDef(t.unit).atk+ (t.unit.hp<5?3:0); if(score>best){best=score;target=t;} } }
      if(target) { act({type:'attack',x:from.x,y:from.y,toX:target.x,toY:target.y}); continue; }
      let objective=null, dist=Infinity;
      for(let y=0;y<state.mapSize;y++) for(let x=0;x<state.mapSize;x++) { const t=state.grid[y][x]; if(t.city&&t.city.owner!==p.id&&!t.unit) { const d=manhattan(from,t); if(d<dist){dist=d;objective=t;} } }
      if(objective) {
        const path=findPath(state,from,u,objective,p);
        if(path&&path.length) { const step=path[path.length-1]; act({type:'move',x:from.x,y:from.y,toX:step.x,toY:step.y}); }
        else {
          const step=neighbors(state,from.x,from.y,true).filter(t=>!t.unit&&unitCanUseTerrain(state,u,t,p)).sort((a,b)=>manhattan(a,objective)-manhattan(b,objective))[0];
          if(step && manhattan(step,objective)<manhattan(from,objective)) act({type:'move',x:from.x,y:from.y,toX:step.x,toY:step.y});
        }
      } else {
        const path=neighbors(state,from.x,from.y,true).find(t=>!t.unit&&unitCanUseTerrain(state,u,t,p)); if(path) act({type:'move',x:from.x,y:from.y,toX:path.x,toY:path.y});
      }
    }
    // Train affordable units from cities with spare capacity.
    for(const ct of citiesOf(state,p.id)) {
      if(countUnitsForCity(state,ct.city.id)>=ct.city.level) continue;
      const types=p.aiType==='ECONOMY'?['DEFENDER','ARCHER','WARRIOR','RIDER','SWORDSMAN']:p.aiType==='EXPANSION'?['RIDER','WARRIOR','ARCHER','SWORDSMAN','DEFENDER']:p.aiType==='WAR'?['SWORDSMAN','KNIGHT','WARRIOR','RIDER','ARCHER','DEFENDER']:['WARRIOR','RIDER','ARCHER','DEFENDER','SWORDSMAN','KNIGHT']; const type=types.map(id=>({id,def:UNITS[id]})).filter(o=>o.def&&(!o.def.req||hasTech(p,o.def.req))&&p.stars>=o.def.cost).sort((a,b)=>b.def.atk-a.def.atk)[0];
      if(type) act({type:'train',x:ct.x,y:ct.y,unitType:type.id});
    }
    // Keep city economy current, then finish the turn.
    recalcEconomy(state,p);
    if(state.activePlayer===p.id&&!state.over) endTurn(state,p.id);
    return state;
  }
  function advanceAI(state, maxTurns) {
    let steps=0, limit=maxTurns||30;
    while(!state.over&&steps<limit) { const p=playerById(state,state.activePlayer); if(!p||!p.isAI) break; const oldTurn=state.turn, oldPlayer=p.id; aiTurn(state,p.id); steps++; if(state.activePlayer===oldPlayer&&state.turn===oldTurn) break; }
    return state;
  }
  function getTileActions(state, playerId, x, y) {
    const p=playerById(state,playerId), t=tileAt(state,x,y); if(!p||!t) return [];
    const actions=[];
    if(t.resource && RESOURCE_INFO[t.resource] && hasTech(p,RESOURCE_INFO[t.resource].tech) && (closestOwnedCity(state,p.id,t,3)|| (t.city&&t.city.owner===p.id))) actions.push({type:'harvest',label:`Собрать: ${RESOURCE_INFO[t.resource].label}`});
    if(t.unit&&t.unit.owner===p.id) {
      if(t.unit.type==='MIND_BENDER') actions.push({type:'heal',label:'Лечение / обращение'});
      if(t.unit.type==='CLOAK') actions.push({type:'infiltrate',label:'Проникнуть в город'});
      if(unitDef(t.unit).domain==='naval') actions.push({type:'disembark',label:'Высадиться'});
      if(t.building&&t.building.type==='PORT'&&hasTech(p,'SAILING')&&unitDef(t.unit).domain!=='naval') actions.push({type:'embark',label:'Посадить на плот'});
    }
    if(t.city&&t.city.owner===p.id) {
      if(t.city.pendingLevelUp) actions.push({type:'upgradeCity',label:`Улучшить город до ${t.city.level+1} уровня`});
      if(countUnitsForCity(state,t.city.id)<t.city.level) actions.push({type:'train',label:'Обучить отряд'});
      if(hasTech(p,'SAILING')&&!t.building&&neighbors(state,x,y,true).some(n=>n.terrain===TERRAIN.WATER||n.terrain===TERRAIN.OCEAN)) actions.push({type:'port',label:'Построить порт (10★)'});
    }
    if(closestOwnedCity(state,p.id,t,3)|| (t.city&&t.city.owner===p.id)) {
      if(hasTech(p,'ROADS')&&!t.hasRoad) actions.push({type:'road',label:'Построить дорогу (1★)'});
      if(hasTech(p,'FARMING')&&t.terrain===TERRAIN.PLAIN&&!t.building) actions.push({type:'farm',label:'Построить ферму (5★)'});
      if(hasTech(p,'MINING')&&t.resource===RESOURCE.ORE&&!t.building) actions.push({type:'mine',label:'Построить шахту (5★)'});
      if(hasTech(p,'FORESTRY')&&t.terrain===TERRAIN.FOREST&&!t.building) actions.push({type:'hut',label:'Построить хижину (3★)'});
      if(hasTech(p,'FORESTRY')&&t.terrain===TERRAIN.FOREST) actions.push({type:'clear',label:'Расчистить лес (+2★)'});
      if(hasTech(p,'CHIVALRY')&&t.terrain===TERRAIN.FOREST) actions.push({type:'burn',label:'Выжечь лес'});
      if(hasTech(p,'MEDITATION')&&t.terrain===TERRAIN.MOUNTAIN&&!t.building) actions.push({type:'temple',label:'Построить горный храм (10★)'});
      if(hasTech(p,'SPIRITUALISM')&&t.terrain===TERRAIN.FOREST&&!t.building) actions.push({type:'forestTemple',label:'Построить лесной храм (10★)'});
      if(hasTech(p,'AQUATISM')&&(t.terrain===TERRAIN.WATER||t.terrain===TERRAIN.OCEAN)&&!t.building) actions.push({type:'waterTemple',label:'Построить водный храм (10★)'});
      if(hasTech(p,'MATHEMATICS')&&!t.building) actions.push({type:'sawmill',label:'Построить лесопилку (5★)'});
      if(hasTech(p,'SMITHING')&&!t.building) actions.push({type:'forge',label:'Построить кузницу (5★)'});
      if(hasTech(p,'TRADE')&&!t.building) actions.push({type:'customHouse',label:'Построить торговый дом (5★)'});
      if(hasTech(p,'SPIRITUALISM')&&t.terrain===TERRAIN.PLAIN&&!t.building) actions.push({type:'forest',label:'Посадить лес (3★)'});
    }
    if(t.city&&t.city.owner!==p.id&&t.city.capital&&hasTech(p,'DIPLOMACY')&&!t.building) actions.push({type:'embassy',label:'Открыть посольство (5★)'});
    return actions;
  }
  function status(state) { return {turn:state.turn,activePlayer:state.activePlayer,over:state.over,winner:state.winner,mapSize:state.mapSize,players:state.players.map(p=>({id:p.id,name:p.name,tribe:p.tribe,stars:p.stars,spt:p.spt,score:p.score,alive:p.alive,isAI:p.isAI,cities:citiesOf(state,p.id).length,units:unitsOf(state,p.id).length,techCount:p.techs.length}))}; }

  return { TERRAIN, RESOURCE, TERRAIN_INFO, RESOURCE_INFO, TRIBES, TECHS, UNITS, LEVEL_BONUSES, MONUMENTS,
    createGame, performAction, endTurn, aiTurn, advanceAI, getTileActions, getPlayerView, legalResearch, techCost,
    recomputeVisibility, recalcEconomy, citiesOf, unitsOf, playerById, tileAt, neighbors, unitDef,
    hasTech, status, addLog, calculateDamage, findPath };
});
