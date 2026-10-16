'use strict';

const assert = require('assert');
const { Engine } = require('./game.js');

function run() {
  const received = [];
  const peer = { testPeer: true };
  const engine = new Engine({ rng: () => 0.5 });
  const send = message => received.push(message);
  const latestState = () => received.filter(message => message.t === 'st').slice(-1)[0];
  const command = (c, a) => engine.handle({ t: 'cmd', c, a: a || {} }, peer, send);

  engine.handle({ t: 'join', name: 'Тестовый герой', cls: 'warrior', tok: 'test-token-01' }, peer, send);
  assert(latestState(), 'Вход должен вернуть полное состояние');
  assert.strictEqual(latestState().player.name, 'Тестовый герой');
  assert.strictEqual(latestState().location.id, 'settlement');
  assert(received.some(message => message.t === 'log' && message.k === 'good'), 'Вход должен выдать приветственный лог');
  console.log('OK: вход и выдача полного состояния');

  command('move', { to: 'crossroads' });
  assert.strictEqual(latestState().location.id, 'crossroads', 'Переход должен сменить локацию');
  assert(latestState().map.nodes.some(node => node.id === 'crossroads' && node.visited), 'Посещённая локация должна открыться на карте');
  console.log('OK: переход и карта посещённых локаций');

  command('search');
  assert(latestState().combat && latestState().combat.hp > 0, 'Исследование с контрольным RNG должно создать врага');
  console.log('OK: исследование и появление противника');

  const hpBeforeTicks = latestState().player.hp;
  engine.tick();
  engine.tick();
  engine.tick();
  assert.strictEqual(engine.tickCount, 3, 'Тики должны учитывать прошедшие секунды');
  assert(latestState().combat, 'Противник должен оставаться в бою до победы');
  assert(latestState().player.hp <= hpBeforeTicks, 'Противник должен атаковать в реальном времени');
  console.log('OK: боевые тики и ответные атаки противника');

  for (let index = 0; index < 30 && latestState().combat; index += 1) {
    command('attack');
    engine.tick();
    engine.tick();
  }
  assert.strictEqual(latestState().combat, null, 'Повторные атаки должны завершить бой');
  assert(latestState().player.xp > 0, 'Победа должна начислять опыт');
  assert(received.some(message => message.t === 'log' && /Победа над врагом/.test(message.m)), 'Победа должна появиться в журнале');
  console.log('OK: атаки, завершение боя, награды');

  command('quest');
  assert(latestState().player.quest && latestState().player.quest.count >= 3, 'Задание должно активироваться');
  const saved = engine.exportPlayers();
  const restored = new Engine({ players: saved, rng: () => 0.5 });
  assert.strictEqual(restored.exportPlayer('test-token-01').location, latestState().player.location, 'Сохранение должно восстанавливать локацию');
  assert(restored.exportPlayer('test-token-01').visited.includes('crossroads'), 'Сохранение должно хранить туман войны');
  console.log('OK: задания и экспорт/импорт сохранения');
  const shared = new Engine({ rng: () => 0.5 });
  const firstPeer = { id: 'first' };
  const secondPeer = { id: 'second' };
  const firstMessages = [];
  const secondMessages = [];
  const firstSend = message => firstMessages.push(message);
  const secondSend = message => secondMessages.push(message);
  const latest = messages => messages.filter(message => message.t === 'st').slice(-1)[0];
  shared.handle({ t: 'join', name: 'Игрок один', cls: 'warrior', tok: 'shared-one' }, firstPeer, firstSend);
  shared.handle({ t: 'join', name: 'Игрок два', cls: 'mage', tok: 'shared-two' }, secondPeer, secondSend);
  shared.handle({ t: 'cmd', c: 'move', a: { to: 'crossroads' } }, firstPeer, firstSend);
  shared.handle({ t: 'cmd', c: 'move', a: { to: 'crossroads' } }, secondPeer, secondSend);
  shared.handle({ t: 'cmd', c: 'search', a: {} }, firstPeer, firstSend);
  const sharedEnemyHp = latest(firstMessages).combat.hp;
  shared.handle({ t: 'cmd', c: 'attack', a: {} }, secondPeer, secondSend);
  assert(latest(firstMessages).combat.hp < sharedEnemyHp, 'Второй игрок должен наносить урон общей цели');
  assert.strictEqual(latest(firstMessages).nearby.length, 1, 'Состояние должно содержать игрока рядом');
  shared.handle({ t: 'cmd', c: 'chat', a: { m: 'Привет всем' } }, firstPeer, firstSend);
  assert(secondMessages.some(message => message.t === 'log' && message.k === 'chat' && /Привет всем/.test(message.m)), 'Чат должен доставляться всем подключениям');
  const secondLocation = latest(secondMessages).location.id;
  shared.disconnect(secondPeer);
  const reconnectPeer = { id: 'second-reconnect' };
  const reconnectMessages = [];
  shared.handle({ t: 'join', name: 'Игрок два', cls: 'mage', tok: 'shared-two' }, reconnectPeer, message => reconnectMessages.push(message));
  assert.strictEqual(latest(reconnectMessages).location.id, secondLocation, 'Токен должен восстанавливать прогресс после переподключения');
  assert.strictEqual(latest(reconnectMessages).online, 2, 'Число игроков онлайн должно обновляться после переподключения');
  console.log('OK: общая цель, список игроков, глобальный чат и восстановление по токену');
  console.log('Все тесты игрового движка пройдены.');
}

run();
