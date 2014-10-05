var esprima = require('esprima');
var escope = require('escope');
var fs = require('fs');
var _ = require('underscore');
var path = require('path');
var diveSync = require('diveSync');

var CONFIG_FILENAME = 'jsimports.json';

var jsfile = function(pathToFile) {
	this.path = path.resolve(pathToFile);
	this.src = fs.readFileSync(this.path);
};

jsfile.prototype = _.extend(jsfile.prototype, {
	/**
	 * Returns true if this is a valid requirejs module.
	 */
	isModule: function() {
		var tree = this.getTree();

		if (tree.body) {
			if (tree.body.length > 0) {
				if (tree.body[0].expression) {
					if (tree.body[0].expression.callee) {
						if (tree.body[0].expression.callee.name) {
							return tree.body[0].expression.callee.name == 'define';
						}
					}
				}
			}
		}

		return false;
	},

	/**
	 * Cache for the esprima source tree
	 */
	_tree: null,

	/**
	 * Returns esprima source tree
	 */
	getTree: function() {
		if (this._tree == null) {
			try {
				this._tree = esprima.parse(this.src);
			} catch (err) {
				throw new Error('Invalid js file (not readable by Esprima). ' + err);
			}
		}

		return this._tree;
	}


});


var jsanalyzer = function(pathBelowConfig) {

	this.config = {
		config: null,
		basePath: null,
		excludeDirs: []
	};

	this.pathBelowConfig = pathBelowConfig;
	this.readConfig();
	this.readRequirejsConfig();

};

jsanalyzer.prototype = _.extend(jsanalyzer.prototype, {

	/**
	 * Tries to find config file and read it and extend this.config
	 */
	readConfig: function() {
		var configPath = path.dirname(this.pathBelowConfig)+'/'+CONFIG_FILENAME;

		while (!fs.existsSync(configPath)) {
			if (path.dirname(configPath) == '/') {
				throw {
					name: 'ConfigNotFoundError',
					message: 'Could not find any config file'
				};
			}

			configPath = path.resolve(path.dirname(configPath) + '/../' + CONFIG_FILENAME);
		}

		try {
			var config = JSON.parse(fs.readFileSync(configPath));
			this.config = _.extend(this.config, config);

			if (this.config.config !== null) {
				this.config.config = path.resolve(path.dirname(configPath), this.config.config);
			}
			if (this.config.basePath !== null) {
				this.config.basePath = path.resolve(path.dirname(configPath), this.config.basePath);
			}

		} catch (err) {
			throw {
				name: 'InvalidConfigError',
				message: 'Could not parse jsimports config file. Error:' + err
			};
		}
	},

	/**
	 * Returns list of paths and shims from the RequireJS config file
	 */
	readRequirejsConfig: function() {
		if (this.config.config === null) {
			return;
		}

		var options = {};
		require.config = function(configObj) {
			options = configObj;
		};
		// THIS MAY BE VERY HARMFUL:
		eval(fs.readFileSync(this.config.config, 'utf-8'));
		delete require.config;

		var shims = {};

		for (var lib in options.paths) {
			shims[lib] = lib;
		}

		for (var shim in options.shim) {
			var exports = options.shim[shim].exports;
			if (exports) {
				shims[exports] = shim;
			}
		}

		this.modulesFromConfig = shims;
	},


	/**
	 * Finds all modules in base path
	 */
	findModules: function() {
		var _this = this;
		var files = [];

		diveSync(this.config.basePath, function(err, file) {
			if (/\.js$/.test(file)) {
				files.push(file);
			}
		});

		// Filter out files that is not AMD modules:
		files = _.filter(files, function(file) {
			try {
				var tree = esprima.parse(fs.readFileSync(file));
				return _this.isModule(tree);
			} catch (e) {
				return false;
			}
		});

		files = _.reduce(files, function(files, file) {
			var clss = file.split("/").pop();
			clss = clss.substr(0, clss.length-3);

			var path = file.substr(0, file.length-3);
			path = path.substr(this.config.basePath.length + 1);

			if (!_.any(this.config.excludeDirs, function(dir) {
				return path.indexOf(dir) == 0;
			})) {
				files[clss] = path;
			}

			return files;
		}, {});

		this.modules = files;
	},

	/**
	 * Sorts dependencies so that they are grouped by directories. Those
	 * without any "/" should go first
	 */
	sortFunc: function(dep) {
		var deppath = dep.path;

		if (deppath.split('!').length > 1) {
			deppath = _.rest(deppath.split('!')).join('!');
		}

		var groups = (deppath.split('/').length == 1);
		var prefix = '';
		if (groups == 1) {
			prefix = '0';
		}

		var pad = '000000000000000000000000000000';

		if (deppath.split('/').length == 1) {
			pad = '00000000000000000000000000000';
		}

		return _.reduce(deppath.split('/'), function(result, part) {
			var padded = (part + pad).slice(0, pad.length);
			return result + padded;
		}, prefix);
	},

	


});


module.exports = {
	jsanalyzer: jsanalyzer,
	jsfile: jsfile
};
