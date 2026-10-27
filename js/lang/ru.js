/*
 * Russian translation (UI strings).
 * Keys are matched case-insensitively against the full text of a DOM text node.
 * Capitalisation of the original is preserved (see i18n.js: matchCase).
 * To add a string: just add "english text": "русский текст". Untranslated text stays English.
 */
define([], function() {
	var exact = {
		//login
		'what\'s new': 'новости',
		'faction quartermasters': 'Интенданты фракций',
		'new unlockable skin': 'Новый открываемый облик',
		'new map: city sewer': 'Новая карта: городская канализация',
		'factions and reputations': 'Фракции и репутация',
		'you can now filter the chat window': 'Теперь чат можно фильтровать',
		'prophecies. when creating a new character you can choose which prophecies to apply. this includes a permadeath prophecy called \'hardcore\'.': 'Пророчества. При создании нового персонажа можно выбрать, какие пророчества применить. Среди них есть пророчество перманентной смерти «хардкор».',
		'register': 'регистрация',
		'login': 'войти',
		'username': 'имя пользователя',
		'password': 'пароль',
		'pledge on patreon': 'Поддержать на Patreon',
		'donate on paypal': 'Пожертвовать через PayPal',
		'access the wiki': 'Открыть вики',

		//characters
		'loading characters...': 'загрузка персонажей...',
		'new': 'новый',
		'delete': 'удалить',
		'play': 'играть',

		//create character
		'name': 'имя',
		'back': 'назад',
		'create': 'создать',
		'prophecies': 'пророчества',
		'wizard': 'маг',
		'cleric': 'жрец',
		'thief': 'вор',
		'warrior': 'воин',
		'hardcore': 'хардкор',
		'titangrip': 'хватка титана',
		'crushable': 'хрупкость',
		'butcher': 'мясник',
		'stone-skinned': 'каменная кожа',
		'waterproof': 'водонепроницаемость',
		'wolfborn': 'рождённый волком',
		'demonic': 'демонический',
		'death is permanent': 'смерть необратима',
		'gain double stats from weapons': 'двойные характеристики от оружия',
		'take quadruple damage from all sources': 'вы получаете учетверённый урон из любых источников',
		'you can engage other butchers in combat': 'вы можете вступать в бой с другими мясниками',

		//death
		'respawn': 'возродиться',
		'log out': 'выйти',

		//equipment
		'hero': 'герой',
		'basic': 'основные',
		'offense': 'атака',
		'defense': 'защита',
		'misc': 'прочее',

		//help
		'movement:': 'Движение:',
		'wasd / arrow keys': 'WASD / стрелки; на телефоне — касание карты',
		'cancel movement:': 'Отмена движения:',
		'combat:': 'Бой:',
		'hover on an enemy and press 1 to enable auto-attack': 'Наведите курсор на врага и нажмите 1, чтобы включить автоатаку',
		'chat:': 'Чат:',
		'press enter to open the chat window': 'Нажмите Enter, чтобы открыть окно чата',
		'inventory:': 'Инвентарь:',
		'press i to open your inventory': 'Нажмите I, чтобы открыть инвентарь',
		'equipment:': 'Экипировка:',
		'click on an item in your inventory to equip it': 'Нажмите на предмет в инвентаре, чтобы надеть его',
		'stats:': 'Характеристики:',
		'wizards and clerics need int to deal more damage. thieves need dex and warriors need str': 'Магам и жрецам нужен интеллект для большего урона. Ворам нужна ловкость, а воинам — сила',
		'show nameplates:': 'Показать имена:',
		'who\'s online:': 'Кто в сети:',

		//inventory / items
		'inventory': 'инвентарь',
		'crafting material': 'материал для ремесла',
		'[shift] to compare': '[shift] — сравнить',
		'quest item': 'квестовый предмет',
		'equip': 'надеть',
		'unequip': 'снять',
		'drop': 'выбросить',
		'destroy': 'уничтожить',
		'salvage': 'разобрать',
		'stash': 'в хранилище',
		'learn': 'выучить',
		'unlearn': 'забыть',
		'withdraw': 'забрать',
		'augment': 'улучшить',
		'whisper': 'шёпот',

		//leaderboard / reputation / trade
		'leaderboard': 'таблица лидеров',
		'level': 'уровень',
		'none': 'нет',
		'mine': 'мои',
		'refresh': 'обновить',
		'reputations': 'репутация',
		'trade': 'обмен',

		//messages
		'info': 'инфо',
		'reputation': 'репутация',
		'players': 'игроки',
		'loot': 'добыча',

		//options
		'continue': 'продолжить',
		'windowed': 'оконный режим',
		'fullscreen': 'полный экран',
		'character select': 'выбор персонажа',
		'language': 'язык',

		//party
		'decline': 'отклонить',
		'accept': 'принять',
		'need': 'нужно',
		'greed': 'жадность',

		//quests
		'quests': 'задания',
		'click to turn in': 'нажмите, чтобы сдать',

		//smithing
		'augment item': 'улучшение предмета',
		'action': 'действие',
		'scour': 'очистить',
		'item': 'предмет',
		'material': 'материал',
		'success': 'успех',
		'item enhancement succeeded': 'Предмет успешно улучшен',
		'item scouring succeeded': 'Предмет успешно очищен',
		'item enhancement failed': 'Улучшение не удалось',
		'incorrect item type': 'Неверный тип предмета',
		'cannot augment equipped items': 'Нельзя улучшать надетые предметы',

		//stats (js/misc/statTranslations.js)
		'vitality': 'живучесть',
		'health regeneration': 'регенерация здоровья',
		'maximum mana': 'максимум маны',
		'mana regeneration': 'регенерация маны',
		'strength': 'сила',
		'intellect': 'интеллект',
		'dexterity': 'ловкость',
		'armor': 'броня',
		'increased crit chance': 'повышенный шанс крита',
		'magic find': 'поиск магических предметов',
		'sprint chance': 'шанс спринта',
		'to all damage': 'ко всему урону',
		'to all attributes': 'ко всем атрибутам',
		'additional xp per kill': 'доп. опыта за убийство',
		'increased arcane damage': 'повышенный урон тайной магией',
		'increased frost damage': 'повышенный урон холодом',
		'increased fire damage': 'повышенный урон огнём',
		'increased holy damage': 'повышенный урон святой магией',
		'increased physical damage': 'повышенный физический урон',
		'increased poison damage': 'повышенный урон ядом',
		'arcane resistance': 'сопротивление тайной магии',
		'frost resistance': 'сопротивление холоду',
		'fire resistance': 'сопротивление огню',
		'holy resistance': 'сопротивление святой магии',
		'physical resistance': 'сопротивление физическому урону',
		'poison resistance': 'сопротивление яду',
		'all resistance': 'все сопротивления',
		'stats': 'характеристики',

		//elements
		'arcane': 'тайная магия',
		'frost': 'холод',
		'fire': 'огонь',
		'holy': 'святая магия',
		'physical': 'физический',
		'poison': 'яд'
	};

	//Russian plural: 1 раз, 2-4 раза, 5+ раз
	var plural = function(n, one, few, many) {
		var m10 = n % 10;
		var m100 = n % 100;
		if ((m10 == 1) && (m100 != 11))
			return one;
		if ((m10 >= 2) && (m10 <= 4) && ((m100 < 12) || (m100 > 14)))
			return few;
		return many;
	};

	//Each pattern: [regex, function(match, tr) -> string]. tr() translates a fragment using the dictionary.
	var patterns = [
		[/^level: (\d+)$/i, function(m) {
			return 'уровень: ' + m[1];
		}],
		[/^click delete (\d+) more times? to confirm$/i, function(m) {
			var n = ~~m[1];
			return 'нажмите «удалить» ещё ' + n + ' ' + plural(n, 'раз', 'раза', 'раз') + ' для подтверждения';
		}],
		[/^delete \((\d+)\)$/i, function(m) {
			return 'удалить (' + m[1] + ')';
		}],
		[/^roll: (\d+)$/i, function(m) {
			return 'бросок: ' + m[1];
		}],
		[/^winner: (\d+)$/i, function(m) {
			return 'победитель: ' + m[1];
		}],
		[/^faction: (.+)$/i, function(m, tr) {
			return 'фракция: ' + tr(m[1]);
		}],
		[/^element: (.+)$/i, function(m, tr) {
			return 'стихия: ' + tr(m[1]);
		}],
		[/^\((.+)\)$/, function(m, tr) {
			return '(' + tr(m[1]) + ')';
		}],
		//"+12 vitality", "-5% fire resistance", "10 armor" etc.
		[/^([+\-]?[\d.,]+%?)\s+([a-z][a-z \-]+)$/i, function(m, tr) {
			var t = tr(m[2]);
			return (t == m[2]) ? null : (m[1] + ' ' + t);
		}]
	];

	return {
		name: 'Русский',
		exact: exact,
		patterns: patterns
	};
});
