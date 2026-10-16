(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GameEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CLASSES = {
    warrior: {
      id: 'warrior', name: 'Воин', description: 'Много здоровья и защиты. Хорошо держит удар.',
      hp: 132, mp: 36, atk: 13, def: 8, hpUp: 19, mpUp: 5, atkUp: 2.1, defUp: 1.2, crit: 0.08, flee: 0.48,
      skills: [
        { id: 'shield_bash', name: 'Удар щитом', min: 1, cost: 5, power: 1.25, cooldown: 3, text: 'Урон и шанс оглушить цель на 2 хода.', effect: 'stun', chance: 0.68 },
        { id: 'heavy_strike', name: 'Тяжёлый удар', min: 3, cost: 8, power: 1.9, cooldown: 4, text: 'Сильная атака.', effect: null },
        { id: 'brace', name: 'Стойка защиты', min: 5, cost: 10, power: 0, cooldown: 6, text: 'Снижает следующий полученный урон.', effect: 'guard', chance: 1 },
        { id: 'cleave', name: 'Рассекающий удар', min: 7, cost: 14, power: 2.2, cooldown: 5, text: 'Мощный удар по противнику.', effect: null }
      ]
    },
    mage: {
      id: 'mage', name: 'Маг', description: 'Большой запас маны и сильные заклинания.',
      hp: 82, mp: 104, atk: 16, def: 3, hpUp: 14, mpUp: 13, atkUp: 2.7, defUp: 0.7, crit: 0.07, flee: 0.53,
      skills: [
        { id: 'fireball', name: 'Огненный шар', min: 1, cost: 13, power: 1.75, cooldown: 3, text: 'Урон и поджог на 3 хода.', effect: 'burn', chance: 0.9 },
        { id: 'frost_bolt', name: 'Ледяная стрела', min: 3, cost: 15, power: 1.5, cooldown: 4, text: 'Урон и шанс оглушить цель.', effect: 'stun', chance: 0.42 },
        { id: 'mana_surge', name: 'Прилив маны', min: 5, cost: 0, power: 0, cooldown: 7, text: 'Восстанавливает ману.', effect: 'mana', chance: 1 },
        { id: 'storm', name: 'Разряд', min: 7, cost: 25, power: 2.5, cooldown: 5, text: 'Мощный магический урон.', effect: null }
      ]
    },
    rogue: {
      id: 'rogue', name: 'Вор', description: 'Критические удары, яд и высокий шанс побега.',
      hp: 98, mp: 58, atk: 15, def: 5, hpUp: 16, mpUp: 8, atkUp: 2.5, defUp: 0.9, crit: 0.30, flee: 0.76,
      skills: [
        { id: 'poison_blade', name: 'Ядовитый клинок', min: 1, cost: 8, power: 1.25, cooldown: 3, text: 'Урон и яд на 4 хода.', effect: 'poison', chance: 0.92 },
        { id: 'backstab', name: 'Удар из тени', min: 3, cost: 12, power: 2.15, cooldown: 4, text: 'Сильный удар с повышенным шансом крита.', effect: 'backstab' },
        { id: 'quick_step', name: 'Быстрый шаг', min: 5, cost: 10, power: 0, cooldown: 6, text: 'Повышает шанс уклониться от следующего удара.', effect: 'evade' },
        { id: 'crippling_cut', name: 'Калечащий порез', min: 7, cost: 16, power: 1.8, cooldown: 5, text: 'Урон и ослабление противника.', effect: 'weaken', chance: 0.8 }
      ]
    }
  };

  const LOCATIONS = [
    { id: 'settlement', name: 'Поселение', x: 49, y: 53, level: 1, desc: 'Небольшое безопасное поселение. Здесь есть лавка, кузница и таверна.', exits: ['crossroads', 'river_bank', 'old_road'], enemies: [], town: true },
    { id: 'crossroads', name: 'Перекрёсток', x: 31, y: 43, level: 1, desc: 'Несколько старых дорог расходятся среди камней и кустарника.', exits: ['settlement', 'forest_edge', 'quarry', 'hunter_camp'], enemies: ['wolf', 'slime', 'bandit'] },
    { id: 'river_bank', name: 'Берег реки', x: 68, y: 66, level: 1, desc: 'У берега можно найти лечебные травы и следы зверей.', exits: ['settlement', 'marsh', 'ruins'], enemies: ['wolf', 'spider', 'slime'] },
    { id: 'old_road', name: 'Старая дорога', x: 58, y: 39, level: 2, desc: 'Разбитая дорога ведёт к заброшенным строениям.', exits: ['settlement', 'quarry', 'ruins'], enemies: ['bandit', 'skeleton'] },
    { id: 'forest_edge', name: 'Опушка', x: 19, y: 29, level: 2, desc: 'Между деревьями видны узкие тропы и свежие следы.', exits: ['crossroads', 'deep_forest'], enemies: ['wolf', 'spider', 'bandit'] },
    { id: 'hunter_camp', name: 'Лагерь охотников', x: 37, y: 18, level: 3, desc: 'Пустые стоянки и кострища. Кто-то недавно проходил здесь.', exits: ['crossroads', 'deep_forest', 'bandit_hideout'], enemies: ['wolf', 'bandit'] },
    { id: 'quarry', name: 'Каменоломня', x: 47, y: 32, level: 3, desc: 'В скалах попадаются куски руды, но шум привлекает существ.', exits: ['crossroads', 'old_road', 'abandoned_mine', 'mountain_pass'], enemies: ['slime', 'bandit', 'skeleton'] },
    { id: 'deep_forest', name: 'Глубокий лес', x: 10, y: 15, level: 4, desc: 'Тропы здесь легко потерять. Между стволами мелькают силуэты.', exits: ['forest_edge', 'hunter_camp', 'marsh', 'bandit_hideout'], enemies: ['wolf', 'spider', 'forest_guard'] },
    { id: 'abandoned_mine', name: 'Заброшенная шахта', x: 63, y: 19, level: 5, desc: 'Подпорки скрипят, а из глубины доносится глухой стук.', exits: ['quarry', 'mountain_pass', 'cave'], enemies: ['skeleton', 'mine_beast', 'slime'] },
    { id: 'ruins', name: 'Старые руины', x: 79, y: 43, level: 4, desc: 'Разрушенные стены скрывают старые тайники и опасные ловушки.', exits: ['river_bank', 'old_road', 'marsh', 'ancient_gate'], enemies: ['skeleton', 'bandit', 'ruin_guard'] },
    { id: 'marsh', name: 'Топь', x: 87, y: 61, level: 5, desc: 'Под ногами хлюпает вода. В густом тумане трудно заметить угрозу.', exits: ['river_bank', 'deep_forest', 'ruins'], enemies: ['spider', 'marsh_creature', 'slime'] },
    { id: 'mountain_pass', name: 'Горный проход', x: 55, y: 7, level: 6, desc: 'Узкий проход между скалами продувается холодным ветром.', exits: ['quarry', 'abandoned_mine', 'cave', 'northern_camp'], enemies: ['mine_beast', 'mountain_beast', 'bandit'] },
    { id: 'bandit_hideout', name: 'Лагерь разбойников', x: 22, y: 5, level: 6, desc: 'Среди поваленных брёвен видны дозорные места и кострища.', exits: ['hunter_camp', 'deep_forest'], enemies: ['bandit', 'bandit_leader'] },
    { id: 'cave', name: 'Каменная пещера', x: 73, y: 7, level: 7, desc: 'Пещера уходит вглубь. Эхо шагов возвращается с задержкой.', exits: ['abandoned_mine', 'mountain_pass', 'northern_camp'], enemies: ['spider', 'cave_beast', 'skeleton'] },
    { id: 'ancient_gate', name: 'Старинные ворота', x: 96, y: 34, level: 7, desc: 'Массивные каменные ворота стоят посреди заросшей дороги.', exits: ['ruins', 'northern_camp'], enemies: ['ruin_guard', 'forest_guard'] },
    { id: 'northern_camp', name: 'Северная стоянка', x: 91, y: 12, level: 8, desc: 'На открытом плато сохранились следы недавнего большого привала.', exits: ['mountain_pass', 'cave', 'ancient_gate'], enemies: ['mountain_beast', 'cave_beast', 'bandit_leader'] }
  ];

  const ENEMIES = {
    wolf: { name: 'Волк', hp: 42, atk: 10, def: 2, xp: 24, gold: [5, 12], rate: 2, loot: ['fang', 'herb'] },
    slime: { name: 'Слизень', hp: 50, atk: 8, def: 1, xp: 22, gold: [4, 10], rate: 3, loot: ['herb', 'ore'] },
    bandit: { name: 'Разбойник', hp: 58, atk: 12, def: 3, xp: 32, gold: [9, 19], rate: 2, loot: ['fang', 'ore'] },
    spider: { name: 'Паук', hp: 48, atk: 11, def: 2, xp: 29, gold: [5, 15], rate: 2, loot: ['fang', 'herb'] },
    skeleton: { name: 'Скелет', hp: 68, atk: 13, def: 5, xp: 38, gold: [8, 19], rate: 3, loot: ['ore', 'fang'] },
    forest_guard: { name: 'Лесной страж', hp: 82, atk: 16, def: 5, xp: 52, gold: [12, 24], rate: 2, loot: ['herb', 'iron_sword'] },
    mine_beast: { name: 'Шахтный зверь', hp: 92, atk: 18, def: 6, xp: 59, gold: [12, 28], rate: 3, loot: ['ore', 'iron_sword'] },
    ruin_guard: { name: 'Страж руин', hp: 105, atk: 20, def: 8, xp: 70, gold: [15, 32], rate: 3, loot: ['ore', 'steel_sword'] },
    marsh_creature: { name: 'Топяник', hp: 86, atk: 17, def: 4, xp: 56, gold: [10, 26], rate: 2, loot: ['herb', 'fang'] },
    mountain_beast: { name: 'Горный зверь', hp: 128, atk: 23, def: 8, xp: 88, gold: [18, 38], rate: 3, loot: ['ore', 'steel_sword'] },
    cave_beast: { name: 'Пещерный хищник', hp: 140, atk: 24, def: 7, xp: 96, gold: [20, 42], rate: 2, loot: ['fang', 'steel_sword'] },
    bandit_leader: { name: 'Главарь разбойников', hp: 150, atk: 25, def: 9, xp: 104, gold: [25, 50], rate: 2, loot: ['ore', 'steel_sword'] }
  };

  const ITEMS = {
    hp_potion: { id: 'hp_potion', name: 'Зелье лечения', type: 'consumable', use: 'heal', amount: 48, price: 18, description: 'Восстанавливает здоровье.' },
    mp_potion: { id: 'mp_potion', name: 'Зелье маны', type: 'consumable', use: 'mana', amount: 42, price: 18, description: 'Восстанавливает ману.' },
    fang: { id: 'fang', name: 'Клык', type: 'material', price: 7, description: 'Материал для продажи.' },
    herb: { id: 'herb', name: 'Лечебная трава', type: 'material', price: 6, description: 'Материал для продажи.' },
    ore: { id: 'ore', name: 'Руда', type: 'material', price: 15, description: 'Нужна для улучшения снаряжения.' },
    worn_sword: { id: 'worn_sword', baseName: 'Поношенный меч', name: 'Поношенный меч', type: 'weapon', baseAtk: 3, atk: 3, def: 0, speed: 2, tier: 1, price: 25, description: 'Простой меч.' },
    hunter_dagger: { id: 'hunter_dagger', baseName: 'Охотничий кинжал', name: 'Охотничий кинжал', type: 'weapon', baseAtk: 4, atk: 4, def: 0, speed: 1, tier: 1, price: 35, description: 'Лёгкое оружие с быстрым темпом атаки.' },
    wooden_staff: { id: 'wooden_staff', baseName: 'Деревянный посох', name: 'Деревянный посох', type: 'weapon', baseAtk: 5, atk: 5, def: 0, speed: 2, tier: 1, price: 40, description: 'Посох для начинающего мага.' },
    iron_sword: { id: 'iron_sword', baseName: 'Железный меч', name: 'Железный меч', type: 'weapon', baseAtk: 8, atk: 8, def: 0, speed: 2, tier: 2, price: 85, description: 'Надёжный меч.' },
    steel_sword: { id: 'steel_sword', baseName: 'Стальной меч', name: 'Стальной меч', type: 'weapon', baseAtk: 13, atk: 13, def: 0, speed: 2, tier: 3, price: 155, description: 'Оружие высокого качества.' },
    leather_armor: { id: 'leather_armor', baseName: 'Кожаный доспех', name: 'Кожаный доспех', type: 'armor', baseAtk: 0, atk: 0, baseDef: 3, def: 3, speed: 0, tier: 1, price: 65, description: 'Лёгкая защита.' },
    iron_armor: { id: 'iron_armor', baseName: 'Железный доспех', name: 'Железный доспех', type: 'armor', baseAtk: 0, atk: 0, baseDef: 7, def: 7, speed: 0, tier: 2, price: 130, description: 'Тяжёлый защитный доспех.' }
  };

  const SHOP_IDS = ['hp_potion', 'mp_potion', 'worn_sword', 'hunter_dagger', 'wooden_staff', 'iron_sword', 'leather_armor', 'iron_armor', 'ore'];
  const STARTER_ITEMS = ['hp_potion', 'hp_potion', 'mp_potion'];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const randomInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const copy = value => JSON.parse(JSON.stringify(value));
  const cleanText = (value, max) => String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

  class Engine {
    constructor(options) {
      const opts = options || {};
      this.rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
      this.players = new Map();
      this.transports = new Map();
      this.peerTokens = new Map();
      this.sessions = new Map();
      this.rooms = new Map();
      this.tickCount = 0;
      this.itemSeq = 1;
      LOCATIONS.forEach(location => this.rooms.set(location.id, { enemy: null }));
      const saved = opts.players || {};
      Object.keys(saved).forEach(tok => {
        if (saved[tok] && typeof saved[tok] === 'object') {
          const player = this._hydratePlayer(saved[tok], tok);
          if (player) this.players.set(tok, player);
        }
      });
    }

    _newUid() { return 'i' + this.itemSeq++ + '-' + Math.floor(this.rng() * 1000000000).toString(36); }

    _makeItem(id, options) {
      const template = ITEMS[id];
      if (!template) return null;
      const opts = options || {};
      const item = copy(template);
      item.uid = this._newUid();
      item.qty = 1;
      if (item.type === 'weapon' || item.type === 'armor') {
        item.baseAtk = Number(item.baseAtk || 0);
        item.baseDef = Number(item.baseDef || 0);
        item.bonus = Number(opts.bonus || 0);
        if (opts.dropped && !opts.bonus) {
          const roll = this.rng();
          item.bonus = roll < 0.10 ? 3 : roll < 0.40 ? 2 : 1;
        }
        item.atk = item.baseAtk + item.bonus;
        item.def = item.baseDef + item.bonus;
        item.name = item.bonus > 0 ? item.baseName + ' +' + item.bonus : item.baseName;
        if (opts.keepUid) item.uid = opts.keepUid;
      }
      return item;
    }

    _newPlayer(name, cls, tok) {
      const classId = CLASSES[cls] ? cls : 'warrior';
      const player = {
        tok, name: cleanText(name, 24) || 'Путник', cls: classId, level: 1, xp: 0, gold: 70,
        hp: CLASSES[classId].hp, mp: CLASSES[classId].mp, maxHp: CLASSES[classId].hp, maxMp: CLASSES[classId].mp,
        atk: CLASSES[classId].atk, def: CLASSES[classId].def, location: 'settlement', visited: ['settlement'],
        inventory: [], equipment: { weapon: null, armor: null }, effects: {}, guard: 0, cooldown: 0, skillCooldowns: {},
        quest: null, lastRegenTick: 0, createdAt: Date.now()
      };
      STARTER_ITEMS.forEach(id => this._addItem(player, this._makeItem(id)));
      const starterWeapon = this._makeItem(classId === 'mage' ? 'wooden_staff' : classId === 'rogue' ? 'hunter_dagger' : 'worn_sword');
      player.equipment.weapon = starterWeapon;
      player.equipment.armor = this._makeItem('leather_armor');
      this._refreshDerived(player, true);
      return player;
    }

    _hydratePlayer(data, tok) {
      if (!data || !CLASSES[data.cls]) return null;
      const p = copy(data);
      p.tok = tok;
      p.name = cleanText(p.name, 24) || 'Путник';
      p.level = clamp(Math.floor(Number(p.level) || 1), 1, 100);
      p.xp = Math.max(0, Number(p.xp) || 0);
      p.gold = Math.max(0, Math.floor(Number(p.gold) || 0));
      p.location = LOCATIONS.some(l => l.id === p.location) ? p.location : 'settlement';
      p.visited = Array.isArray(p.visited) ? Array.from(new Set(p.visited.filter(id => LOCATIONS.some(l => l.id === id)))) : ['settlement'];
      if (!p.visited.includes('settlement')) p.visited.push('settlement');
      if (!p.visited.includes(p.location)) p.visited.push(p.location);
      p.inventory = Array.isArray(p.inventory) ? p.inventory.filter(i => i && ITEMS[i.id]).slice(0, 80) : [];
      p.inventory.forEach(i => {
        if (!i.uid) i.uid = this._newUid();
        i.qty = Math.max(1, Math.floor(Number(i.qty) || 1));
      });
      p.equipment = p.equipment && typeof p.equipment === 'object' ? p.equipment : { weapon: null, armor: null };
      ['weapon', 'armor'].forEach(slot => {
        const item = p.equipment[slot];
        if (!item || !ITEMS[item.id] || ITEMS[item.id].type !== slot) p.equipment[slot] = null;
        else {
          if (!item.uid) item.uid = this._newUid();
          item.atk = Number(item.atk) || 0;
          item.def = Number(item.def) || 0;
          item.bonus = Number(item.bonus) || 0;
          item.speed = Number(item.speed) || 0;
        }
      });
      p.effects = p.effects && typeof p.effects === 'object' ? p.effects : {};
      p.skillCooldowns = p.skillCooldowns && typeof p.skillCooldowns === 'object' ? p.skillCooldowns : {};
      p.quest = p.quest && typeof p.quest === 'object' ? p.quest : null;
      p.cooldown = Math.max(0, Number(p.cooldown) || 0);
      p.guard = Math.max(0, Number(p.guard) || 0);
      this._refreshDerived(p, false);
      p.hp = clamp(Number.isFinite(Number(p.hp)) ? Number(p.hp) : p.maxHp, 0, p.maxHp);
      p.mp = clamp(Number.isFinite(Number(p.mp)) ? Number(p.mp) : p.maxMp, 0, p.maxMp);
      return p;
    }

    _refreshDerived(p, refill) {
      const c = CLASSES[p.cls] || CLASSES.warrior;
      const oldHp = Number(p.hp);
      const oldMp = Number(p.mp);
      p.maxHp = Math.floor(c.hp + (p.level - 1) * c.hpUp);
      p.maxMp = Math.floor(c.mp + (p.level - 1) * c.mpUp);
      const weapon = p.equipment && p.equipment.weapon;
      const armor = p.equipment && p.equipment.armor;
      p.atk = Math.round((c.atk + (p.level - 1) * c.atkUp + (weapon ? Number(weapon.atk || 0) : 0)) * 10) / 10;
      p.def = Math.round((c.def + (p.level - 1) * c.defUp + (armor ? Number(armor.def || 0) : 0)) * 10) / 10;
      if (refill || !Number.isFinite(oldHp)) p.hp = p.maxHp;
      else p.hp = clamp(oldHp, 0, p.maxHp);
      if (refill || !Number.isFinite(oldMp)) p.mp = p.maxMp;
      else p.mp = clamp(oldMp, 0, p.maxMp);
    }

    _addItem(p, item) {
      if (!item) return;
      const stacks = item.type === 'material' || item.type === 'consumable';
      if (stacks) {
        const existing = p.inventory.find(i => i.id === item.id && i.type === item.type);
        if (existing) { existing.qty += Math.max(1, item.qty || 1); return; }
      }
      p.inventory.push(item);
    }

    exportPlayers() {
      const out = {};
      this.players.forEach((p, tok) => { out[tok] = copy(p); });
      return out;
    }

    exportPlayer(tok) {
      const p = this.players.get(tok);
      return p ? copy(p) : null;
    }

    handle(message, peer, sendFn) {
      if (!peer) return;
      if (typeof sendFn === 'function') this.transports.set(peer, sendFn);
      if (!message || typeof message !== 'object') return;
      try {
        if (message.t === 'join') this._join(message, peer);
        else if (message.t === 'cmd') this._command(message, peer);
      } catch (error) {
        this._logPeer(peer, 'Действие не выполнено: ' + cleanText(error && error.message ? error.message : 'неизвестная ошибка', 120), 'bad');
        this._sendState(peer);
      }
    }

    _join(message, peer) {
      const tok = cleanText(message.tok, 100);
      if (!tok) { this._logPeer(peer, 'Не удалось определить игрока. Обновите страницу.', 'bad'); return; }
      const fresh = !this.players.has(tok);
      let p = this.players.get(tok);
      if (fresh) {
        p = this._newPlayer(message.name, message.cls, tok);
        this.players.set(tok, p);
      } else {
        p.name = cleanText(message.name, 24) || p.name || 'Путник';
      }
      const priorPeer = this.sessions.get(tok);
      this.peerTokens.set(peer, tok);
      this.sessions.set(tok, peer);
      if (priorPeer && priorPeer !== peer) {
        this.peerTokens.delete(priorPeer);
      }
      this._logPeer(peer, fresh ? 'Добро пожаловать. Путь начинается в поселении.' : 'Прогресс загружен. Вы вернулись в мир.', 'good');
      this._broadcastRoom(p.location, p.name + ' вошёл в локацию.', 'chat');
      this._broadcastStates();
    }

    disconnect(peer) {
      const tok = this.peerTokens.get(peer);
      this.transports.delete(peer);
      this.peerTokens.delete(peer);
      if (!tok || this.sessions.get(tok) !== peer) return;
      this.sessions.delete(tok);
      const p = this.players.get(tok);
      if (p) this._broadcastRoom(p.location, p.name + ' вышел из мира.', 'chat');
      this._broadcastStates();
    }

    _token(peer) {
      const tok = this.peerTokens.get(peer);
      return tok && this.sessions.get(tok) === peer ? tok : null;
    }

    _send(peer, message) {
      const send = this.transports.get(peer);
      if (typeof send === 'function') {
        try { send(copy(message)); } catch (_) { /* Transport may already be closed. */ }
      }
    }

    _logPeer(peer, message, kind) { this._send(peer, { t: 'log', m: String(message), k: kind || 'warn' }); }

    _broadcastLog(message, kind, location) {
      this.sessions.forEach((peer, tok) => {
        const p = this.players.get(tok);
        if (!location || (p && p.location === location)) this._logPeer(peer, message, kind);
      });
    }

    _broadcastRoom(location, message, kind) { this._broadcastLog(message, kind, location); }

    _command(message, peer) {
      const tok = this._token(peer);
      if (!tok) return;
      const p = this.players.get(tok);
      const command = cleanText(message.c, 40);
      const a = message.a && typeof message.a === 'object' ? message.a : {};
      if (!p) return;
      if (command === 'chat') {
        const text = cleanText(a.m, 180);
        if (text) this._broadcastLog(p.name + ': ' + text, 'chat');
        this._sendState(peer);
        return;
      }
      if (command === 'move') this._move(p, a.to);
      else if (command === 'search') this._search(p);
      else if (command === 'attack') this._attack(p);
      else if (command === 'skill') this._skill(p, cleanText(a.id, 40));
      else if (command === 'flee') this._flee(p);
      else if (command === 'use') this._use(p, a.slot);
      else if (command === 'equip') this._equip(p, a.slot);
      else if (command === 'sell') this._sell(p, a.slot);
      else if (command === 'buy') this._buy(p, cleanText(a.id, 40));
      else if (command === 'rest') this._rest(p);
      else if (command === 'quest') this._quest(p);
      else if (command === 'upgrade') this._upgrade(p, a);
      else if (command === 'save') { /* The server persists player state on its save interval. */ }
      else this._logPeer(peer, 'Неизвестное действие.', 'warn');
      this._broadcastStates();
    }

    _loc(id) { return LOCATIONS.find(l => l.id === id) || LOCATIONS[0]; }
    _room(id) { return this.rooms.get(id); }
    _isInFight(p) { const room = this._room(p.location); return Boolean(room && room.enemy && room.enemy.hp > 0); }

    _move(p, destination) {
      const here = this._loc(p.location);
      const next = LOCATIONS.find(l => l.id === destination);
      if (!next || !here.exits.includes(next.id)) { this._logForPlayer(p, 'Туда нет известного прохода.', 'warn'); return; }
      if (this._isInFight(p)) { this._logForPlayer(p, 'Сначала нужно победить врага или попытаться сбежать.', 'warn'); return; }
      const previous = p.location;
      p.location = next.id;
      if (!p.visited.includes(next.id)) p.visited.push(next.id);
      this._broadcastRoom(previous, p.name + ' покинул локацию.', 'chat');
      this._broadcastRoom(next.id, p.name + ' прибыл в локацию.', 'chat');
      this._logForPlayer(p, 'Вы прибыли: ' + next.name + '. ' + next.desc, 'good');
    }

    _search(p) {
      if (p.hp <= 0) { this._logForPlayer(p, 'Сначала нужно возродиться.', 'warn'); return; }
      if (this._isInFight(p)) { this._logForPlayer(p, 'Враг уже здесь. Придётся сражаться или бежать.', 'warn'); return; }
      const roll = this.rng();
      const loc = this._loc(p.location);
      if (!loc.enemies.length) {
        const bonus = randomInt(this.rng, 8, 22) + p.level * 2;
        p.gold += bonus;
        this._logForPlayer(p, 'На рынке удалось найти подработку. Получено ' + bonus + ' золота.', 'good');
      } else if (roll < 0.65) {
        this._spawnEnemy(p.location);
        const enemy = this._room(p.location).enemy;
        enemy.participants.push(p.tok);
        this._broadcastRoom(p.location, p.name + ' обнаружил противника: ' + enemy.name + ' (' + enemy.level + ' ур.).', 'hit');
      } else if (roll < 0.85) {
        const gold = randomInt(this.rng, 12, 30) + loc.level * 4;
        p.gold += gold;
        this._logForPlayer(p, 'В тайнике найдено ' + gold + ' золота.', 'good');
      } else if (roll < 0.95) {
        const candidates = ['hp_potion', 'mp_potion', 'fang', 'herb', 'ore', 'worn_sword', 'hunter_dagger', 'wooden_staff', 'iron_sword', 'leather_armor'];
        const id = candidates[randomInt(this.rng, 0, candidates.length - 1)];
        const item = this._makeItem(id, { dropped: ITEMS[id].type === 'weapon' || ITEMS[id].type === 'armor' });
        this._addItem(p, item);
        this._logForPlayer(p, 'Найден предмет: ' + item.name + '.', 'good');
      } else {
        const damage = randomInt(this.rng, 8, 16) + loc.level * 2;
        p.hp = Math.max(1, p.hp - damage);
        this._logForPlayer(p, 'Ловушка! Получено ' + damage + ' урона.', 'bad');
      }
    }

    _spawnEnemy(locationId) {
      const room = this._room(locationId);
      if (room.enemy && room.enemy.hp > 0) return room.enemy;
      const loc = this._loc(locationId);
      const nearby = this._connectedPlayersAt(locationId);
      const averageLevel = nearby.length ? nearby.reduce((sum, p) => sum + p.level, 0) / nearby.length : 1;
      const minLevel = Math.max(loc.level, Math.floor(averageLevel));
      const key = loc.enemies[randomInt(this.rng, 0, loc.enemies.length - 1)];
      const base = ENEMIES[key] || ENEMIES.wolf;
      const level = clamp(minLevel + randomInt(this.rng, 0, 1), 1, 100);
      const partyScale = 1 + Math.min(0.8, Math.max(0, nearby.length - 1) * 0.18);
      room.enemy = {
        id: key, name: base.name, level,
        hp: Math.floor((base.hp + level * 5) * partyScale),
        maxHp: Math.floor((base.hp + level * 5) * partyScale),
        atk: Math.floor((base.atk + level * 1.35) * (1 + Math.max(0, nearby.length - 1) * 0.08)),
        def: base.def + Math.floor(level * 0.3), xp: base.xp + level * 8,
        gold: base.gold, rate: base.rate, attackTimer: base.rate, effects: {}, participants: [],
        loot: base.loot.slice(), weakened: false
      };
      return room.enemy;
    }

    _attack(p) {
      const enemy = this._room(p.location).enemy;
      if (!enemy || enemy.hp <= 0) { this._logForPlayer(p, 'Здесь нет противника. Используйте «Искать».', 'warn'); return; }
      if (!this._canAct(p)) return;
      const weapon = p.equipment.weapon;
      const delay = clamp(Number(weapon && weapon.speed ? weapon.speed : 2), 1, 4);
      p.cooldown = delay;
      this._registerParticipant(enemy, p.tok);
      const c = CLASSES[p.cls];
      let damage = Math.max(1, Math.floor((p.atk * (0.86 + this.rng() * 0.28)) - enemy.def * 0.48));
      const critical = this.rng() < c.crit;
      if (critical) damage = Math.floor(damage * 1.75);
      this._damageEnemy(p, enemy, damage, critical ? 'Критический удар! ' : '');
    }

    _canAct(p) {
      if (p.hp <= 0) { this._logForPlayer(p, 'Вы не можете действовать без сознания.', 'warn'); return false; }
      if (p.effects.stun > 0) { this._logForPlayer(p, 'Оглушение не даёт действовать.', 'warn'); return false; }
      if (p.cooldown > 0) { this._logForPlayer(p, 'Действие ещё перезаряжается (' + p.cooldown + ').', 'warn'); return false; }
      return true;
    }

    _skill(p, id) {
      const skill = (CLASSES[p.cls].skills || []).find(s => s.id === id && p.level >= s.min);
      if (!skill) { this._logForPlayer(p, 'Этот навык пока недоступен.', 'warn'); return; }
      if (!this._canAct(p)) return;
      if ((p.skillCooldowns[id] || 0) > 0) { this._logForPlayer(p, 'Навык перезаряжается (' + p.skillCooldowns[id] + ').', 'warn'); return; }
      if (p.mp < skill.cost) { this._logForPlayer(p, 'Недостаточно маны.', 'warn'); return; }
      const targetEnemy = this._room(p.location).enemy;
      const needsTarget = !['mana', 'guard', 'evade'].includes(skill.effect);
      if (needsTarget && (!targetEnemy || targetEnemy.hp <= 0)) {
        this._logForPlayer(p, 'Для этого навыка нужен противник.', 'warn');
        return;
      }
      p.mp -= skill.cost;
      p.skillCooldowns[id] = skill.cooldown;
      p.cooldown = Math.max(1, Number(p.equipment.weapon && p.equipment.weapon.speed || 2));
      if (skill.effect === 'mana') {
        const gained = Math.min(p.maxMp - p.mp, 36 + p.level * 3);
        p.mp += gained;
        this._logForPlayer(p, 'Прилив маны восстановил ' + gained + ' маны.', 'good');
        return;
      }
      if (skill.effect === 'guard') {
        p.guard = Math.max(p.guard, 2);
        this._logForPlayer(p, 'Вы приняли защитную стойку. Следующий удар будет ослаблен.', 'good');
        return;
      }
      if (skill.effect === 'evade') {
        p.effects.evade = 3;
        this._logForPlayer(p, 'Вы готовы уклониться от следующего удара.', 'good');
        return;
      }
      const enemy = targetEnemy;
      this._registerParticipant(enemy, p.tok);
      let multiplier = skill.power || 1;
      let criticalChance = CLASSES[p.cls].crit;
      if (skill.effect === 'backstab') criticalChance += 0.35;
      const critical = this.rng() < criticalChance;
      let damage = Math.max(1, Math.floor((p.atk * multiplier * (0.9 + this.rng() * 0.2)) - enemy.def * 0.35));
      if (critical) damage = Math.floor(damage * 1.65);
      this._damageEnemy(p, enemy, damage, skill.name + (critical ? ' — крит! ' : ': '));
      if (enemy.hp > 0 && skill.effect && ['stun', 'burn', 'poison', 'weaken'].includes(skill.effect) && this.rng() < (skill.chance == null ? 1 : skill.chance)) {
        if (skill.effect === 'stun') enemy.effects.stun = Math.max(enemy.effects.stun || 0, 2);
        if (skill.effect === 'burn') enemy.effects.burn = Math.max(enemy.effects.burn || 0, 3);
        if (skill.effect === 'poison') enemy.effects.poison = Math.max(enemy.effects.poison || 0, 4);
        if (skill.effect === 'weaken') enemy.weakened = true;
        const label = { stun: 'оглушён', burn: 'горит', poison: 'отравлен', weaken: 'ослаблен' }[skill.effect];
        this._broadcastRoom(p.location, enemy.name + ' — ' + label + '.', 'good');
      }
    }

    _registerParticipant(enemy, tok) { if (!enemy.participants.includes(tok)) enemy.participants.push(tok); }

    _damageEnemy(p, enemy, damage, prefix) {
      enemy.hp = Math.max(0, enemy.hp - damage);
      this._broadcastRoom(p.location, (prefix || '') + p.name + ' наносит ' + damage + ' урона. ' + enemy.name + ': ' + enemy.hp + '/' + enemy.maxHp + ' HP.', 'hit');
      if (enemy.hp <= 0) this._defeatEnemy(p.location, enemy, p.tok);
    }

    _defeatEnemy(locationId, enemy, finalTok) {
      const room = this._room(locationId);
      if (!room || room.enemy !== enemy) return;
      const participants = Array.from(new Set(enemy.participants.concat(finalTok))).map(tok => this.players.get(tok)).filter(p => p && p.location === locationId);
      const gold = randomInt(this.rng, enemy.gold[0], enemy.gold[1]) + enemy.level * 2;
      participants.forEach(p => {
        const gainedXp = enemy.xp;
        p.xp += gainedXp;
        const share = Math.max(1, Math.floor(gold / Math.max(1, participants.length)));
        p.gold += share;
        this._logForPlayer(p, 'Победа над врагом: +' + gainedXp + ' опыта, +' + share + ' золота.', 'good');
        if (p.quest && p.quest.target === 'monster') {
          p.quest.progress += 1;
          if (p.quest.progress >= p.quest.count) {
            p.gold += p.quest.rewardGold;
            p.xp += p.quest.rewardXp;
            this._logForPlayer(p, 'Задание выполнено: +' + p.quest.rewardGold + ' золота и +' + p.quest.rewardXp + ' опыта.', 'good');
            p.quest = null;
          } else this._logForPlayer(p, 'Прогресс задания: ' + p.quest.progress + '/' + p.quest.count + '.', 'good');
        }
        this._checkLevel(p);
        if (this.rng() < 0.76) {
          const lootId = enemy.loot[randomInt(this.rng, 0, enemy.loot.length - 1)];
          const tmpl = ITEMS[lootId];
          const item = this._makeItem(lootId, { dropped: tmpl && (tmpl.type === 'weapon' || tmpl.type === 'armor') });
          if (item) {
            this._addItem(p, item);
            this._logForPlayer(p, 'Добыча: ' + item.name + '.', 'good');
          }
        }
      });
      room.enemy = null;
      this._broadcastRoom(locationId, enemy.name + ' повержен.', 'good');
    }

    _checkLevel(p) {
      let needed = this.xpNeeded(p.level);
      let leveled = false;
      while (p.xp >= needed && p.level < 100) {
        p.xp -= needed;
        p.level += 1;
        this._refreshDerived(p, true);
        leveled = true;
        needed = this.xpNeeded(p.level);
      }
      if (leveled) this._logForPlayer(p, 'Новый уровень: ' + p.level + '! Здоровье и мана восстановлены.', 'good');
    }

    xpNeeded(level) { return 100 + Math.max(0, level - 1) * 60; }

    _flee(p) {
      if (!this._isInFight(p)) { this._logForPlayer(p, 'Сейчас не от кого убегать.', 'warn'); return; }
      if (!this._canAct(p)) return;
      const chance = CLASSES[p.cls].flee;
      p.cooldown = 1;
      if (this.rng() < chance) {
        const loc = this._loc(p.location);
        const options = loc.exits.map(id => this._loc(id));
        const target = options.length ? options[randomInt(this.rng, 0, options.length - 1)] : this._loc('settlement');
        const previous = p.location;
        p.location = target.id;
        if (!p.visited.includes(target.id)) p.visited.push(target.id);
        this._logForPlayer(p, 'Вы успешно отступили: ' + target.name + '.', 'good');
        this._broadcastRoom(previous, p.name + ' отступил.', 'chat');
        this._broadcastRoom(target.id, p.name + ' прибыл в локацию.', 'chat');
      } else this._logForPlayer(p, 'Не удалось сбежать!', 'bad');
    }

    _isRoomThreatening(locationId) { const room = this._room(locationId); return Boolean(room && room.enemy && room.enemy.hp > 0); }

    _use(p, slotValue) {
      const slot = Number(slotValue);
      if (!Number.isInteger(slot) || slot < 0 || slot >= p.inventory.length) { this._logForPlayer(p, 'Предмет не найден.', 'warn'); return; }
      const item = p.inventory[slot];
      if (item.type !== 'consumable') { this._logForPlayer(p, 'Этот предмет нельзя использовать.', 'warn'); return; }
      if (item.use === 'heal') {
        const gain = Math.min(p.maxHp - p.hp, item.amount);
        if (gain <= 0) { this._logForPlayer(p, 'Здоровье уже полное.', 'warn'); return; }
        p.hp += gain;
        this._logForPlayer(p, 'Восстановлено ' + gain + ' HP.', 'good');
      } else if (item.use === 'mana') {
        const gain = Math.min(p.maxMp - p.mp, item.amount);
        if (gain <= 0) { this._logForPlayer(p, 'Мана уже полная.', 'warn'); return; }
        p.mp += gain;
        this._logForPlayer(p, 'Восстановлено ' + gain + ' MP.', 'good');
      }
      item.qty -= 1;
      if (item.qty <= 0) p.inventory.splice(slot, 1);
    }

    _equip(p, slotValue) {
      const slot = Number(slotValue);
      if (!Number.isInteger(slot) || slot < 0 || slot >= p.inventory.length) { this._logForPlayer(p, 'Предмет не найден.', 'warn'); return; }
      const item = p.inventory[slot];
      if (item.type !== 'weapon' && item.type !== 'armor') { this._logForPlayer(p, 'Экипировать можно только оружие и броню.', 'warn'); return; }
      const equipSlot = item.type;
      const old = p.equipment[equipSlot];
      p.inventory.splice(slot, 1);
      if (old) p.inventory.push(old);
      p.equipment[equipSlot] = item;
      this._refreshDerived(p, false);
      this._logForPlayer(p, 'Экипировано: ' + item.name + '.', 'good');
    }

    _sell(p, slotValue) {
      if (p.location !== 'settlement') { this._logForPlayer(p, 'Продавать вещи можно в лавке поселения.', 'warn'); return; }
      const slot = Number(slotValue);
      if (!Number.isInteger(slot) || slot < 0 || slot >= p.inventory.length) { this._logForPlayer(p, 'Предмет не найден.', 'warn'); return; }
      const item = p.inventory[slot];
      const price = Math.max(1, Math.floor((Number(item.price) || ITEMS[item.id].price || 1) * 0.45));
      p.gold += price;
      item.qty -= 1;
      if (item.qty <= 0) p.inventory.splice(slot, 1);
      this._logForPlayer(p, 'Продано: ' + item.name + '. Получено ' + price + ' золота.', 'good');
    }

    _buy(p, id) {
      if (p.location !== 'settlement') { this._logForPlayer(p, 'Лавка находится в поселении.', 'warn'); return; }
      if (!SHOP_IDS.includes(id) || !ITEMS[id]) { this._logForPlayer(p, 'Такого товара нет в лавке.', 'warn'); return; }
      const price = ITEMS[id].price;
      if (p.gold < price) { this._logForPlayer(p, 'Недостаточно золота. Нужно ' + price + '.', 'warn'); return; }
      p.gold -= price;
      const item = this._makeItem(id);
      this._addItem(p, item);
      this._logForPlayer(p, 'Куплено: ' + item.name + '.', 'good');
    }

    _rest(p) {
      if (p.location !== 'settlement') { this._logForPlayer(p, 'Отдохнуть можно в таверне поселения.', 'warn'); return; }
      if (this._isInFight(p)) { this._logForPlayer(p, 'Во время боя отдыхать нельзя.', 'warn'); return; }
      const cost = 12 + p.level * 5;
      if (p.gold < cost) { this._logForPlayer(p, 'Для отдыха нужно ' + cost + ' золота.', 'warn'); return; }
      p.gold -= cost;
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      p.effects = {};
      this._logForPlayer(p, 'Вы отдохнули в таверне. Здоровье и мана восстановлены.', 'good');
    }

    _quest(p) {
      if (p.quest) {
        this._logForPlayer(p, 'Текущее задание: победить врагов (' + p.quest.progress + '/' + p.quest.count + ').', 'warn');
        return;
      }
      const count = 3 + Math.floor((p.level - 1) / 2);
      const offer = { name: 'Очистить окрестности', target: 'monster', progress: 0, count, rewardGold: 35 + p.level * 12, rewardXp: 45 + p.level * 18 };
      p.quest = offer;
      this._logForPlayer(p, 'Новое задание: победить ' + count + ' врагов. Награда: ' + offer.rewardGold + ' золота и ' + offer.rewardXp + ' опыта.', 'good');
    }

    _upgrade(p, args) {
      if (p.location !== 'settlement' && p.location !== 'quarry') { this._logForPlayer(p, 'Улучшать снаряжение можно в кузнице поселения или каменоломне.', 'warn'); return; }
      let item;
      if (args.slotType === 'weapon' || args.slotType === 'armor') item = p.equipment[args.slotType];
      else {
        const slot = Number(args.slot);
        if (Number.isInteger(slot) && slot >= 0 && slot < p.inventory.length) item = p.inventory[slot];
      }
      if (!item || (item.type !== 'weapon' && item.type !== 'armor')) { this._logForPlayer(p, 'Выберите оружие или броню для улучшения.', 'warn'); return; }
      if ((item.bonus || 0) >= 5) { this._logForPlayer(p, 'У этого предмета максимальный бонус +5.', 'warn'); return; }
      const ore = p.inventory.find(i => i.id === 'ore');
      const cost = 35 + (item.bonus || 0) * 25;
      if (!ore || ore.qty < 2) { this._logForPlayer(p, 'Для улучшения нужно 2 руды.', 'warn'); return; }
      if (p.gold < cost) { this._logForPlayer(p, 'Для улучшения нужно ' + cost + ' золота.', 'warn'); return; }
      ore.qty -= 2;
      if (ore.qty <= 0) p.inventory.splice(p.inventory.indexOf(ore), 1);
      p.gold -= cost;
      const chance = clamp(0.82 - (item.bonus || 0) * 0.10 - (Number(item.tier) || 1) * 0.035, 0.30, 0.82);
      if (this.rng() < chance) {
        item.bonus = (item.bonus || 0) + 1;
        if (item.type === 'weapon') { item.atk = (item.baseAtk || 0) + item.bonus; }
        else { item.def = (item.baseDef || 0) + item.bonus; }
        item.name = (item.baseName || item.name.replace(/ \+\d+$/, '')) + ' +' + item.bonus;
        this._refreshDerived(p, false);
        this._logForPlayer(p, 'Улучшение удалось: ' + item.name + '. Шанс был ' + Math.round(chance * 100) + '%.', 'good');
      } else this._logForPlayer(p, 'Улучшение не удалось. Руда и золото потеряны.', 'bad');
    }

    _logForPlayer(p, message, kind) {
      const peer = this.sessions.get(p.tok);
      if (peer) this._logPeer(peer, message, kind);
    }

    _connectedPlayersAt(locationId) {
      const list = [];
      this.sessions.forEach((peer, tok) => {
        if (this.peerTokens.get(peer) === tok) {
          const p = this.players.get(tok);
          if (p && p.location === locationId && p.hp > 0) list.push(p);
        }
      });
      return list;
    }

    tick() {
      this.tickCount += 1;
      this.players.forEach(p => {
        if (p.cooldown > 0) p.cooldown -= 1;
        Object.keys(p.skillCooldowns || {}).forEach(id => {
          if (p.skillCooldowns[id] > 0) p.skillCooldowns[id] -= 1;
          if (p.skillCooldowns[id] <= 0) delete p.skillCooldowns[id];
        });
        if (p.effects && p.effects.stun > 0) p.effects.stun -= 1;
        if (p.effects && p.effects.burn > 0 && this.tickCount % 2 === 0 && p.hp > 0) {
          p.effects.burn -= 1;
          const damage = Math.max(2, Math.floor(p.level * 0.8) + 2);
          p.hp = Math.max(0, p.hp - damage);
          this._logForPlayer(p, 'Поджог наносит вам ' + damage + ' урона.', 'hit');
        }
        if (p.effects && p.effects.poison > 0 && this.tickCount % 2 === 1 && p.hp > 0) {
          p.effects.poison -= 1;
          const damage = Math.max(2, Math.floor(p.level * 0.7) + 2);
          p.hp = Math.max(0, p.hp - damage);
          this._logForPlayer(p, 'Яд наносит вам ' + damage + ' урона.', 'hit');
        }
        if (p.effects && p.effects.evade > 0) p.effects.evade -= 1;
        if (p.hp <= 0) this._death(p);
        const room = this._room(p.location);
        if ((!room || !room.enemy) && p.hp > 0 && this.tickCount - p.lastRegenTick >= 5) {
          p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.ceil(p.maxHp * 0.025)));
          p.mp = Math.min(p.maxMp, p.mp + Math.max(1, Math.ceil(p.maxMp * 0.04)));
          p.lastRegenTick = this.tickCount;
        }
      });
      this.rooms.forEach((room, locationId) => {
        const enemy = room.enemy;
        if (!enemy || enemy.hp <= 0) return;
        if (enemy.effects.stun > 0) enemy.effects.stun -= 1;
        if (enemy.effects.burn > 0 && this.tickCount % 2 === 0) {
          enemy.effects.burn -= 1;
          const d = Math.max(2, Math.floor(enemy.level * 1.4) + 3);
          enemy.hp = Math.max(0, enemy.hp - d);
          this._broadcastRoom(locationId, enemy.name + ' получает ' + d + ' урона от огня.', 'hit');
        }
        if (enemy.effects.poison > 0 && this.tickCount % 2 === 1) {
          enemy.effects.poison -= 1;
          const d = Math.max(2, Math.floor(enemy.level * 1.2) + 2);
          enemy.hp = Math.max(0, enemy.hp - d);
          this._broadcastRoom(locationId, enemy.name + ' получает ' + d + ' урона от яда.', 'hit');
        }
        if (enemy.hp <= 0) {
          const tok = enemy.participants[enemy.participants.length - 1];
          this._defeatEnemy(locationId, enemy, tok);
          return;
        }
        if (enemy.effects.stun > 0) return;
        enemy.attackTimer -= 1;
        if (enemy.attackTimer > 0) return;
        enemy.attackTimer = enemy.rate;
        const targets = this._connectedPlayersAt(locationId);
        if (!targets.length) return;
        const target = targets[randomInt(this.rng, 0, targets.length - 1)];
        if (target.effects.stun > 0) target.effects.stun = Math.max(0, target.effects.stun - 1);
        if (target.effects.evade > 0 && this.rng() < 0.7) {
          target.effects.evade = 0;
          this._logForPlayer(target, 'Вы уклонились от атаки.', 'good');
          return;
        }
        let damage = Math.max(1, Math.floor(enemy.atk * (0.8 + this.rng() * 0.4) - target.def * (enemy.weakened ? 0.75 : 0.55)));
        if (target.guard > 0) { damage = Math.max(1, Math.floor(damage * 0.35)); target.guard = 0; }
        const classData = CLASSES[target.cls];
        if (this.rng() < Math.min(0.22, target.def * 0.008)) {
          this._logForPlayer(target, 'Вы увернулись благодаря защите.', 'good');
          return;
        }
        target.hp = Math.max(0, target.hp - damage);
        this._broadcastRoom(locationId, enemy.name + ' наносит ' + target.name + ' ' + damage + ' урона.', 'hit');
        if (target.hp > 0 && (enemy.id === 'spider' || enemy.id === 'marsh_creature') && this.rng() < 0.22) {
          target.effects.poison = Math.max(target.effects.poison || 0, 3);
          this._logForPlayer(target, 'Вы отравлены на 3 хода.', 'bad');
        } else if (target.hp > 0 && enemy.id === 'mountain_beast' && this.rng() < 0.12) {
          target.effects.stun = Math.max(target.effects.stun || 0, 1);
          this._logForPlayer(target, 'Удар зверя оглушил вас.', 'bad');
        }
        if (target.hp <= 0) this._death(target);
      });
      this._broadcastStates();
    }

    _death(p) {
      const lostGold = Math.floor(p.gold * 0.10);
      const lostXp = Math.floor(p.xp * 0.10);
      p.gold -= lostGold;
      p.xp -= lostXp;
      const oldLocation = p.location;
      p.location = 'settlement';
      if (!p.visited.includes('settlement')) p.visited.push('settlement');
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      p.effects = {};
      p.guard = 0;
      p.cooldown = 0;
      p.lastRegenTick = this.tickCount;
      this._logForPlayer(p, 'Вы погибли и возродились в поселении. Потеряно ' + lostGold + ' золота и ' + lostXp + ' опыта.', 'bad');
      this._broadcastRoom(oldLocation, p.name + ' пал в бою.', 'warn');
      this._broadcastRoom('settlement', p.name + ' вернулся в поселение.', 'chat');
    }

    _mapFor(p) {
      const visited = new Set(p.visited);
      const visible = new Set(visited);
      visited.forEach(id => {
        const loc = this._loc(id);
        loc.exits.forEach(next => visible.add(next));
      });
      const nodes = LOCATIONS.filter(l => visible.has(l.id)).map(l => ({
        id: l.id, name: l.name, x: l.x, y: l.y, visited: visited.has(l.id), adjacent: !visited.has(l.id), current: l.id === p.location
      }));
      const visibleIds = new Set(nodes.map(n => n.id));
      const edgeKeys = new Set();
      const edges = [];
      LOCATIONS.forEach(l => {
        if (!visibleIds.has(l.id)) return;
        l.exits.forEach(to => {
          if (!visibleIds.has(to)) return;
          const fromVisited = visited.has(l.id);
          const toVisited = visited.has(to);
          if (!fromVisited && !toVisited) return;
          const key = [l.id, to].sort().join('|');
          if (edgeKeys.has(key)) return;
          edgeKeys.add(key);
          edges.push({ from: l.id, to });
        });
      });
      return { nodes, edges };
    }

    _makeState(tok) {
      const p = this.players.get(tok);
      if (!p) return null;
      const loc = this._loc(p.location);
      const room = this._room(p.location);
      const nearby = this._connectedPlayersAt(p.location).filter(other => other.tok !== tok).map(other => ({ name: other.name, cls: CLASSES[other.cls].name, level: other.level }));
      const exits = loc.exits.map(id => {
        const place = this._loc(id);
        return { id: place.id, name: place.name, level: place.level, visited: p.visited.includes(id) };
      });
      const skills = CLASSES[p.cls].skills.filter(skill => p.level >= skill.min).map(skill => Object.assign({}, skill, { cooldownLeft: p.skillCooldowns[skill.id] || 0 }));
      const player = copy(p);
      player.className = CLASSES[p.cls].name;
      player.xpNeeded = this.xpNeeded(p.level);
      player.skills = skills;
      player.effectsList = Object.keys(p.effects || {}).filter(key => p.effects[key] > 0).map(key => ({ id: key, turns: p.effects[key] }));
      const shop = SHOP_IDS.map(id => ({ id, name: ITEMS[id].name, price: ITEMS[id].price, type: ITEMS[id].type, description: ITEMS[id].description }));
      return {
        t: 'st', player, location: { id: loc.id, name: loc.name, desc: loc.desc, level: loc.level, town: Boolean(loc.town) },
        combat: room && room.enemy ? copy(room.enemy) : null, shop, map: this._mapFor(p), exits, nearby,
        online: this.sessions.size, questOffer: p.quest ? null : { name: 'Очистить окрестности', count: 3 + Math.floor((p.level - 1) / 2), rewardGold: 35 + p.level * 12, rewardXp: 45 + p.level * 18 }
      };
    }

    _sendState(peer) {
      const tok = this._token(peer);
      if (!tok) return;
      const state = this._makeState(tok);
      if (state) this._send(peer, state);
    }

    _broadcastStates() { this.sessions.forEach(peer => this._sendState(peer)); }
  }

  return { Engine, CLASSES, LOCATIONS, ENEMIES, ITEMS };
});
