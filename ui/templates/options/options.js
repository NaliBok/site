define([
	'js/system/events',
	'html!ui/templates/options/template',
	'css!ui/templates/options/styles',
	'js/renderer',
	'ui/factory',
	'js/objects/objects',
	'js/system/client',
	'js/system/i18n'
], function(
	events,
	template,
	styles,
	renderer,
	factory,
	objects,
	client,
	i18n
) {
	return {
		tpl: template,
		centered: true,

		modal: true,

		postRender: function() {
			//this.onEvent('onKeyDown', this.onKeyDown.bind(this));
			this.onEvent('onToggleOptions', this.toggle.bind(this));

			this.el.find('.btnLanguage').on('click', function() {
				i18n.nextLang();
			});
			this.updateLanguageLabel();
			i18n.onChange(this.updateLanguageLabel.bind(this));

			this.el.find('.btnScreen').on('click', this.toggleScreen.bind(this));
			this.el.find('.btnCharSelect').on('click', this.charSelect.bind(this));
			this.el.find('.btnLogOut').on('click', this.logOut.bind(this));
			this.el.find('.btnContinue').on('click', this.toggle.bind(this));

			this.onEvent('onResize', this.onResize.bind(this));
		},

		//Shows "Language: <native name of the current language>"
		updateLanguageLabel: function() {
			this.el.find('.btnLanguage').text(i18n.t('Language') + ': ' + i18n.languages[i18n.lang].name);
		},

		charSelect: function() {
			client.request({
				module: 'cons',
				method: 'unzone'
			});

			renderer.clean();
			objects.onRezone();
			renderer.buildTitleScreen();

			events.emit('onShowCharacterSelect');
			$('[class^="ui"]:not(.ui-container)').each(function(i, el) {
				var ui = $(el).data('ui');
				if ((ui) && (ui.destroy))
					ui.destroy();
			});
			factory.build('characters', {});
		},

		toggleScreen: function() {
			this.el.find('.btnScreen').html(renderer.toggleScreen());
		},

		onResize: function() {
			var isFullscreen = (window.innerHeight == screen.height);
			if (isFullscreen)
				this.el.find('.btnScreen').html('Fullscreen');
			else
				this.el.find('.btnScreen').html('Windowed');
		},

		toggle: function() {
			this.onResize();
		
			this.shown = !this.el.is(':visible');

			if (this.shown) {
				this.show();
				events.emit('onShowOverlay', this.el);
			}
			else {
				this.hide();
				events.emit('onHideOverlay', this.el);
			}
		},

		logOut: function() {
			window.location = window.location;
		},

		onKeyDown: function(key) {
			if (key == 'esc')
				this.toggle();
		}
	}
});