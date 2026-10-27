define([
	'js/system/events',
	'js/renderer'
], function(
	events,
	renderer
) {
	return {
		axes: {
			horizontal: {
				negative: ['left', 'a', 'q', 'z'],
				positive: ['right', 'd', 'e', 'c']
			},
			vertical: {
				negative: ['up', 'w', 'q', 'e'],
				positive: ['down', 's', 'x', 'z', 'c']
			}
		},

		mappings: {
			'8': 'backspace',
			'9': 'tab',
			'13': 'enter',
			'16': 'shift',
			'17': 'ctrl',
			'27': 'esc',
			'37': 'left',
			'38': 'up',
			'39': 'right',
			'40': 'down',
			'46': 'del'
		},

		mouse: {
			button: null,
			x: 0,
			y: 0
		},
		mouseRaw: null,

		keys: {},

		enabled: true,

		init: function() {
			$(window).on('keydown', this.events.keyboard.keyDown.bind(this));
			$(window).on('keyup', this.events.keyboard.keyUp.bind(this));
			events.on('onSceneMove', this.events.mouse.mouseMove.bind(this));

			$('.ui-container')
				.on('mousedown', this.events.mouse.mouseDown.bind(this))
				.on('mouseup', this.events.mouse.mouseUp.bind(this))
				.on('mousemove', this.events.mouse.mouseMove.bind(this))
				.on('touchstart', this.events.touch.touchStart.bind(this))
				.on('touchmove', this.events.touch.touchMove.bind(this))
				.on('touchend touchcancel', this.events.touch.touchEnd.bind(this));
		},

		//Builds the subset of a mouse event the handlers below need, from the first touch point
		touchToMouse: function(e) {
			var oe = e.originalEvent || e;
			var t = (oe.changedTouches && oe.changedTouches[0]) || (oe.touches && oe.touches[0]);
			if (!t)
				return null;

			var rect = $('.ui-container')[0].getBoundingClientRect();

			return {
				target: e.target,
				button: 0,
				offsetX: t.clientX - rect.left,
				offsetY: t.clientY - rect.top
			};
		},

		resetKeys: function() {
			this.keys = {};
		},

		getMapping: function(charCode) {
			if (charCode >= 97)
				return (charCode - 96).toString();

			return (
				this.mappings[charCode] ||
				String.fromCharCode(charCode).toLowerCase()
			);

		},

		isKeyDown: function(key, noConsume) {
			var down = this.keys[key];
			if (down != null) {
				if (noConsume)
					return true;
				else {
					this.keys[key] = 2;
					return (down == 1);
				}
			} else
				return false;
		},
		getAxis: function(name) {
			var axis = this.axes[name];
			if (!axis)
				return 0;

			var result = 0;

			for (var i = 0; i < axis.negative.length; i++) {
				if (this.keys[axis.negative[i]]) {
					result--;
					break;
				}
			}

			for (var i = 0; i < axis.positive.length; i++) {
				if (this.keys[axis.positive[i]]) {
					result++;
					break;
				}
			}

			return result;
		},

		events: {
			keyboard: {
				keyDown: function(e) {
					if (!this.enabled)
						return;

					if (e.target != document.body)
						return true;
					if ((e.keyCode == 9) || (e.keyCode == 8) || (e.keyCode == 122))
						e.preventDefault();

					var key = this.getMapping(e.which);

					if (this.keys[key] != null)
						this.keys[key] = 2;
					else {
						this.keys[key] = 1;
						events.emit('onKeyDown', key);
					}

					if (key == 'backspace')
						return false;
					else if (e.key == 'F11')
						events.emit('onToggleFullscreen');

				},
				keyUp: function(e) {
					if (!this.enabled)
						return;

					if (e.target != document.body)
						return;

					var key = this.getMapping(e.which);

					delete this.keys[key];

					events.emit('onKeyUp', key);
				}
			},
			touch: {
				//Only touches that land on the bare game view are handled; taps on windows/buttons stay normal clicks
				touchStart: function(e) {
					var fake = this.touchToMouse(e);
					if ((!fake) || (!$(e.target).hasClass('ui-container')))
						return;

					//stops the browser from also sending emulated mouse events, scrolling or zooming
					e.preventDefault();

					this.events.mouse.mouseMove.call(this, fake);
					this.events.mouse.mouseDown.call(this, fake);
				},
				touchMove: function(e) {
					var fake = this.touchToMouse(e);
					if ((!fake) || (!$(e.target).hasClass('ui-container')))
						return;

					e.preventDefault();
					this.events.mouse.mouseMove.call(this, fake);
				},
				touchEnd: function(e) {
					var fake = this.touchToMouse(e);
					if ((!fake) || (!$(e.target).hasClass('ui-container')))
						return;

					e.preventDefault();
					this.events.mouse.mouseUp.call(this, fake);
				}
			},
			mouse: {
				mouseDown: function(e) {
					var el = $(e.target);
					if ((!el.hasClass('ui-container')) || (el.hasClass('blocking')))
						return;

					var button = e.button;
					this.mouse.button = button;
					this.mouse.down = true;
					this.mouse.event = e;

					events.emit('mouseDown', this.mouse);
				},
				mouseUp: function(e) {
					var el = $(e.target);
					if ((!el.hasClass('ui-container')) || (el.hasClass('blocking')))
						return;

					var button = e.button;
					this.mouse.button = null;
					this.mouse.down = false;

					events.emit('mouseUp', this.mouse);
				},
				mouseMove: function(e) {
					if (e)
						this.mouseRaw = e;
					else
						e = this.mouseRaw;

					if (!e)
						return;

					var el = $(e.target);
					if ((!el.hasClass('ui-container')) || (el.hasClass('blocking')))
						return;

					this.mouse.x = e.offsetX + (renderer.pos.x);
					this.mouse.y = e.offsetY + (renderer.pos.y);

					events.emit('mouseMove', this.mouse);
				}
			}
		}
	};
});