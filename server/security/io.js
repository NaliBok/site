define([], function() {
	return {
		db: null,

		tables: {
			character: null,
			characterList: null,
			stash: null,
			skins: null,
			login: null,
			leaderboard: null,
			customMap: null
		},

		init: function(cbReady) {
			var createClient = require('@libsql/client').createClient;

			this.db = createClient({
				url: process.env.TURSO_URL || 'file:storage.db',
				authToken: process.env.TURSO_TOKEN
			});

			var statements = Object.keys(this.tables).map(function(t) {
				return `CREATE TABLE IF NOT EXISTS ${t} (key VARCHAR(50), value TEXT)`;
			});

			this.db.batch(statements, 'write')
				.then(function() {
					cbReady();
				})
				.catch(function(e) {
					console.log('DB init error', e);
					cbReady();
				});
		},

		//ent, field
		get: function(options) {
			var key = options.ent;
			var table = options.field;

			options.query = `SELECT * FROM ${table} WHERE key = '${key}' LIMIT 1`;

			this.run(options, function(rs) {
				return rs.rows.length ? rs.rows[0].value : null;
			});
		},

		delete: function(options) {
			var key = options.ent;
			var table = options.field;

			options.query = `DELETE FROM ${table} WHERE key = '${key}'`;

			this.run(options);
		},

		//ent, field, value
		set: function(options) {
			var key = options.ent;
			var table = options.field;

			this.db.execute(`SELECT 1 FROM ${table} WHERE key = '${key}'`)
				.then(this.doesExist.bind(this, options))
				.catch(this.fail.bind(this, options));
		},
		doesExist: function(options, rs) {
			var key = options.ent;
			var table = options.field;

			options.query = `INSERT INTO ${table} (key, value) VALUES('${key}', '${options.value}')`;

			if (rs.rows.length)
				options.query = `UPDATE ${table} SET value = '${options.value}' WHERE key = '${key}'`;

			this.run(options);
		},

		run: function(options, mapResult) {
			this.db.execute(options.query)
				.then(function(rs) {
					if (options.callback)
						options.callback(mapResult ? mapResult(rs) : null);
				})
				.catch(this.fail.bind(this, options));
		},

		fail: function(options, e) {
			console.log('DB error', e);

			if (options.callback)
				options.callback(null);
		}
	};
});
