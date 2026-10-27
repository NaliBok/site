/*
 * Lightweight UI localisation.
 *
 * The UI is built from HTML templates and plain jQuery calls with English strings.
 * Instead of rewriting every template, this module watches the DOM and swaps text nodes
 * (and placeholder/title attributes) using a dictionary (js/lang/<code>.js).
 * The original English text is remembered, so switching back to English is lossless.
 *
 * Not translated (comes from the server / canvas): item names, quest text, mob names, chat.
 * Add strings to js/lang/ru.js to cover more.
 */
define([
	'js/lang/ru'
], function(
	ru
) {
	var languages = {
		en: {
			name: 'English'
		},
		ru: ru
	};

	var order = ['en', 'ru'];
	var storageKey = 'isleward.lang';

	//Text we never touch (player-controlled content)
	var skipTextSelector = 'input, textarea, script, style, .name, [data-i18n="off"]';
	var skipAttrSelector = '.name, [data-i18n="off"]';

	var textOriginal = new WeakMap();	//text node -> original (English) string
	var textShown = new WeakMap();	//text node -> last string we wrote ourselves
	var attrState = new WeakMap();	//element -> { attr: { original, shown } }

	var attrs = ['placeholder', 'title'];
	var listeners = [];

	var matchCase = function(original, translated) {
		var first = original.charAt(0);
		var isUpper = ((first !== first.toLowerCase()) && (first === first.toUpperCase()));
		var tFirst = translated.charAt(0);
		if ((isUpper) && (tFirst === tFirst.toLowerCase()))
			return tFirst.toUpperCase() + translated.substr(1);

		return translated;
	};

	var api = {
		lang: 'en',
		languages: languages,
		order: order,

		init: function() {
			this.lang = this.detect();
			document.documentElement.lang = this.lang;

			var observer = new MutationObserver(this.onMutations.bind(this));
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: attrs
			});

			this.apply(document.body);
			this.preloadFonts();
		},

		detect: function() {
			var saved = null;
			try {
				saved = localStorage.getItem(storageKey);
			} catch (e) {}

			if ((saved) && (languages[saved]))
				return saved;

			var nav = (navigator.language || 'en').toLowerCase();
			if (nav.indexOf('ru') === 0)
				return 'ru';

			return 'en';
		},

		//Canvas/Pixi text is drawn immediately and would use a fallback font if the Cyrillic font is still loading
		preloadFonts: function() {
			if ((!document.fonts) || (!document.fonts.load))
				return;

			document.fonts.load('16px bitty', 'АаЯя').catch(function() {});
			document.fonts.load('16px bitty', 'Aa').catch(function() {});
		},

		setLang: function(lang) {
			if ((!languages[lang]) || (lang === this.lang))
				return;

			this.lang = lang;
			document.documentElement.lang = lang;

			try {
				localStorage.setItem(storageKey, lang);
			} catch (e) {}

			this.apply(document.body);

			listeners.forEach(function(l) {
				l(lang);
			});
		},

		nextLang: function() {
			var i = order.indexOf(this.lang);
			this.setLang(order[(i + 1) % order.length]);
		},

		onChange: function(callback) {
			listeners.push(callback);
		},

		//Wires up a <div class="langSwitch"> containing <span data-lang="xx"> buttons
		bindSwitch: function(container) {
			if (!container)
				return;

			var buttons = container.querySelectorAll('[data-lang]');

			var refresh = function() {
				for (var i = 0; i < buttons.length; i++)
					buttons[i].classList.toggle('active', buttons[i].getAttribute('data-lang') === api.lang);
			};

			for (var i = 0; i < buttons.length; i++) {
				buttons[i].addEventListener('click', function(e) {
					e.stopPropagation();
					api.setLang(this.getAttribute('data-lang'));
				});
			}

			listeners.push(refresh);
			refresh();
		},

		//Translate a string with the current language (use from JS when you build text yourself)
		t: function(str) {
			if (typeof(str) != 'string')
				return str;

			var lang = languages[this.lang];
			if ((!lang) || (!lang.exact))
				return str;

			var parts = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
			var core = parts[2];
			if ((!core) || (!/[A-Za-z]/.test(core)))
				return str;

			var out = this.translateCore(lang, core);
			if (out == null)
				return str;

			return parts[1] + out + parts[3];
		},

		translateCore: function(lang, core) {
			var hit = lang.exact[core.toLowerCase()];
			if (hit != null)
				return matchCase(core, hit);

			var patterns = lang.patterns || [];
			var tr = function(s) {
				var r = api.translateCore(lang, s);
				return (r == null) ? s : r;
			};

			for (var i = 0; i < patterns.length; i++) {
				var m = core.match(patterns[i][0]);
				if (!m)
					continue;

				var res = patterns[i][1](m, tr);
				if (res != null)
					return res;
			}

			return null;
		},

		//---- DOM handling ----

		isSkipped: function(node, forAttr) {
			var el = (node.nodeType == 1) ? node : node.parentNode;
			if (!el)
				return true;

			return !!(el.closest && el.closest(forAttr ? skipAttrSelector : skipTextSelector));
		},

		processText: function(node) {
			var value = node.nodeValue;

			//Our own write coming back through the observer
			if ((textShown.has(node)) && (textShown.get(node) === value))
				return;

			if (this.isSkipped(node))
				return;

			textOriginal.set(node, value);

			var out = this.t(value);
			if (out !== value) {
				textShown.set(node, out);
				node.nodeValue = out;
			} else
				textShown.delete(node);
		},

		processAttr: function(el, attr) {
			if ((!el.getAttribute) || (this.isSkipped(el, true)))
				return;

			var value = el.getAttribute(attr);
			if (value == null)
				return;

			var state = attrState.get(el);
			if (!state)
				attrState.set(el, state = {});
			var s = state[attr];

			if ((s) && (s.shown === value))
				return;

			state[attr] = s = {
				original: value,
				shown: null
			};

			var out = this.t(value);
			if (out !== value) {
				s.shown = out;
				el.setAttribute(attr, out);
			}
		},

		//Re-run translation on a whole subtree (used on language switch and for new nodes)
		apply: function(root) {
			if (!root)
				return;

			if (root.nodeType == 3) {
				this.reapplyText(root);
				return;
			}

			if (root.nodeType != 1)
				return;

			var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
			var n = walker.nextNode();
			while (n) {
				this.reapplyText(n);
				n = walker.nextNode();
			}

			var all = (root.querySelectorAll) ? root.querySelectorAll('[placeholder], [title]') : [];
			for (var i = 0; i < all.length; i++)
				this.reapplyAttrs(all[i]);
			this.reapplyAttrs(root);

			if (root === document.body)
				document.title = 'Isleward';
		},

		reapplyText: function(node) {
			if (this.isSkipped(node))
				return;

			var original = textOriginal.get(node);
			//Text changed by the game since we last wrote it: that is the new original
			if ((original === undefined) || ((textShown.has(node)) && (textShown.get(node) !== node.nodeValue)))
				original = node.nodeValue;

			textOriginal.set(node, original);

			var out = this.t(original);
			if (out !== node.nodeValue) {
				textShown.set(node, out);
				node.nodeValue = out;
			}
			if (out === original)
				textShown.delete(node);
		},

		reapplyAttrs: function(el) {
			attrs.forEach(function(attr) {
				if ((!el.getAttribute) || (el.getAttribute(attr) == null) || (this.isSkipped(el, true)))
					return;

				var state = attrState.get(el) || {};
				var s = state[attr];
				var original = ((s) && (s.shown === el.getAttribute(attr))) ? s.original : el.getAttribute(attr);

				var out = this.t(original);
				attrState.set(el, state);
				state[attr] = {
					original: original,
					shown: (out !== original) ? out : null
				};

				if (out !== el.getAttribute(attr))
					el.setAttribute(attr, out);
			}, this);
		},

		onMutations: function(list) {
			for (var i = 0; i < list.length; i++) {
				var m = list[i];

				if (m.type == 'characterData')
					this.processText(m.target);
				else if (m.type == 'attributes')
					this.processAttr(m.target, m.attributeName);
				else if (m.type == 'childList') {
					for (var j = 0; j < m.addedNodes.length; j++) {
						var added = m.addedNodes[j];
						if (added.nodeType == 3)
							this.processText(added);
						else if (added.nodeType == 1)
							this.applyNew(added);
					}
				}
			}
		},

		//New elements: every text node in them is "original" by definition
		applyNew: function(root) {
			var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
			var n = walker.nextNode();
			while (n) {
				this.processText(n);
				n = walker.nextNode();
			}

			var all = root.querySelectorAll ? root.querySelectorAll('[placeholder], [title]') : [];
			for (var i = 0; i < all.length; i++) {
				this.processAttr(all[i], 'placeholder');
				this.processAttr(all[i], 'title');
			}
			this.processAttr(root, 'placeholder');
			this.processAttr(root, 'title');
		}
	};

	return api;
});
