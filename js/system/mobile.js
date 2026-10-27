/*
 * Mobile / touch support.
 *  - marks <html> with .touch on touch devices
 *  - keeps the --ui-s CSS variable (HUD scale) in sync with the viewport
 *  - shrinks centered windows that are larger than the screen (transform: scale)
 *  - small on-screen buttons for keys that have no touch equivalent (chat, next target)
 */
define([
	'js/system/events',
	'js/system/i18n'
], function(
	events,
	i18n
) {
	var root = document.documentElement;

	var api = {
		isTouch: false,
		uis: [],

		init: function() {
			this.isTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) &&
				(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

			if (this.isTouch)
				root.classList.add('touch');

			this.updateScale();
			$(window).on('resize orientationchange', this.onResize.bind(this));

			events.on('onUiLayout', this.fit.bind(this));

			if (this.isTouch)
				this.buildControls();
		},

		//HUD/chat/menu scale: 1 on desktop-sized screens, down to 0.55 on phones
		updateScale: function() {
			var w = window.innerWidth;
			var h = window.innerHeight;
			var s = Math.min(1, w / 900, h / 520);
			s = Math.max(0.55, ~~(s * 100) / 100);

			root.style.setProperty('--ui-s', s);
			root.classList.toggle('narrow', w < 640);
			root.classList.toggle('short', h < 480);
		},

		onResize: function() {
			this.updateScale();

			//forget windows that were destroyed (e.g. back to character select)
			var uis = this.uis = this.uis.filter(function(ui) {
				return ((ui.el) && ($.contains(document.documentElement, ui.el[0])));
			});
			//wait a tick so the factory has re-centered everything first
			setTimeout(function() {
				uis.forEach(api.fit, api);
			}, 0);
		},

		//Called whenever a window is rendered, shown or re-centered
		fit: function(ui) {
			if ((!ui) || (!ui.el))
				return;

			if (this.uis.indexOf(ui) == -1)
				this.uis.push(ui);

			if ((!ui.centered) && (!ui.centeredX) && (!ui.centeredY))
				return;

			var el = ui.el[0];
			el.style.transform = '';
			el.style.transformOrigin = '';

			//login has its own responsive layout (css/mobile.css)
			if (el.classList.contains('uiLogin'))
				return;

			var w = el.offsetWidth;
			var h = el.offsetHeight;
			if ((!w) || (!h))
				return;

			var margin = 8;
			var k = Math.min(1, (window.innerWidth - margin) / w, (window.innerHeight - margin) / h);
			if (k >= 0.999)
				return;

			el.style.transformOrigin = 'center center';
			el.style.transform = 'scale(' + k.toFixed(3) + ')';
		},

		buildControls: function() {
			var box = $('<div class="mobileControls" data-i18n="off"></div>').appendTo('body');

			var add = function(cls, label, key) {
				$('<div class="mbtn ' + cls + '">' + label + '</div>')
					.appendTo(box)
					.on('touchstart', function(e) {
						e.preventDefault();
						events.emit('onKeyDown', key);
					})
					.on('click', function() {
						//desktop-emulation / hybrid devices
						if (!('ontouchstart' in window))
							events.emit('onKeyDown', key);
					});
			};

			add('btnChat', '&#9993;', 'enter');
			add('btnTarget', '&#9678;', 'tab');
			add('btnNames', 'V', 'v');

			//only visible in game (login/character screens have no player)
			setInterval(function() {
				box.toggle(!!window.player);
			}, 500);
		}
	};

	return api;
});
