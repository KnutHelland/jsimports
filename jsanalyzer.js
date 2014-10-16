var esprima = require('esprima');
var escope = require('escope');
var fs = require('fs');
var _ = require('underscore');
var path = require('path');
var diveSync = require('diveSync');
var ignore = require('./ignore.js');


var CONFIG_FILENAME = 'jsimports.json';


/**
 * Represents a file. Has methods for parsing the file, and if it is a
 * valid AMD module, it can find dependencies etc.
 */
function File(pathToFile) {
	this._project = null;

	if (arguments[1] !== null) {
		this._project = arguments[1];
	}

	if (pathToFile) {
		/**
		 * Absolute path to the file
		 */
		this.path = path.resolve(pathToFile);
		
		/**
		 * Contents (source code) of the file
		 */
		this.src = fs.readFileSync(this.path);
	} else {
		this.path = '';
		this.src = '';
	}

	/**
	 * Cache of the esprima tree. Use getTree to get the tree.
	 */
	this._tree = null;

	this._plugin = null;

	/**
	 * Cache of the escope scopes graph. Use getScopes to get the
	 * graph.
	 */
	this._scopes = null;

	/**
	 * Cache. Use getSpecifiedDependencies
	 */
	this._specifiedDependencies = null;

	/**
	 * Cache. Use getAnonymousDependencies
	 */
	this._anonymousDependencies = null;
};


/**
 * Returns true if the file is a AMD module
 */
File.prototype.isModule = function() {
	try {
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
	} catch (err) {
		if (err.name == 'EsprimaParseError') {
			return false;
		} else {
			throw err;
		}
	}

	return false;
};


/**
 * Returns esprima source tree
 */
File.prototype.getTree = function() {
	if (this._tree == null) {
		try {
			this._tree = esprima.parse(this.src);
		} catch (err) {
			throw {
				name: 'EsprimaParseError',
				message: 'Invalid js file (not readable by Esprima). ' + err
			};
		}
	}

	return this._tree;
};


/**
 * Returns escope scopes
 */
File.prototype.getScopes = function() {
	if (this._scopes == null) {
		var tree = this.getTree();
		this._scopes = escope.analyze(tree).scopes;
	}

	return this._scopes;
};


/**
 * Returns a map of identifiers: paths to all the modules that are
 * specified in the source.
 */
File.prototype.getSpecifiedDependencies = function() {
	if (this._specifiedDependencies == null) {
		var tree = this.getTree();
		var paths = [];
		var names = [];

		try {
			paths = _.pluck(tree.body[0].expression.arguments[0].elements, 'value');
			names = _.pluck(tree.body[0].expression.arguments[1].params, 'name');
		} catch(err) {
			throw {
				name: 'InvalidModule',
				message: 'The file ' + this.path + ' is not a valid AMD module'
			};
		}

		this._specifiedDependencies = {};
		this._anonymousDependencies = [];
		for (var i in paths) {
			if (names[i]) {
				this._specifiedDependencies[names[i]] = paths[i];
			} else {
				this._anonymousDependencies.push(paths[i]);
			}
		}
	}

	return _.extend({}, this._specifiedDependencies);
};


/**
 * If there are more dependencies (paths) than arguments, the
 * dependencies are anonymous, and we have to preserve those.
 */
File.prototype.getAnonymousDependencies = function() {
	if (this._anonymousDependencies == null) {
		this.getSpecifiedDependencies();
	}

	return this._anonymousDependencies.slice(0);
};


/**
 * Returns the identifiers that the module really depends on, based on
 * scope analysis.
 */
File.prototype.getRealDependencies = function() {
	if (this._realDependencies == null) {
		this._realDependencies =  _.chain(this.getScopes()[0].through)
			.pluck('identifier')
			.pluck('name')
			.uniq()
			.difference(ignore)
			.value();

		var names = _.keys(this.getSpecifiedDependencies());

		this._realDependencies = this._realDependencies.concat(
			_.chain(this.getScopes()[1].variables)
				.filter(function(v) { return v.references.length != 0; })
				.pluck('name')
				.filter(function(n) { return _.contains(names, n); })
				.without('arguments')
				.value());
	}
	return this._realDependencies;
};


File.prototype.getPath = function() {
	return this.path;
};


File.prototype.getProject = function() {
	if (this._project == null) {
		this._project = new Project(this.path);
	}

	return this._project;
};


/**
 * If the file is a plugin type, this function returns the name of the
 * plugin.
 */
File.prototype.isPlugin = function() {
	if (this._plugin === null) {
		var config = this.getProject().getConfig();
		var path = this.getPath();

		for (var plugin in config.plugins) {
			var ext = config.plugins[plugin];

			if (path.substr(path.length - ext.length) == ext) {
				this._plugin = plugin;
				break;
			}
		}

		if (this._plugin === null) {
			this._plugin = false;
		}
	}

	return this._plugin;
};


/**
 * Checks wether a dependency is circular
 */
File.prototype.isCircular = function(depPath) {
	var _this = this;
	var circular = false;

	var list = [this.path];
	var recursive = function(dep, list) {
		if (String(dep) == '') {
			return;
		}

		var file = _this.getProject().getFile(dep+'.js');

		if (file && file.isModule()) {
			list = list.concat(file.path);

			if (list.length != _.uniq(list).length) {
				circular = true;
				return;
			}

			var deps = _.values(file.getSpecifiedDependencies());
			deps = deps.concat(file.getAnonymousDependencies());

			_.each(deps, function(dep) {
				recursive(dep, list);
			});

		}
	};
	recursive(depPath, list);
	return circular;
};



/**
 * Returns sorted list of dependencies that can be used to create a
 * new define-section.
 *
 * [{ name: 'nameToModule', path: 'pathToModule', comment: 'commentToPath', plugin: '' }]
 *
 * In addition you should append the anonymous dependencies!
 */
File.prototype.getResolvedDependencies = function() {
	var _this = this;

	if (this._resolvedDependencies == null) {
		var output = [];

		var deps = this.getRealDependencies();

		// Add all dependencies that we want to keep as original:
		var nonEmptySpecified = _.reduce(this.getSpecifiedDependencies(), function(out, path, name) { if (path != "") { out[name] = path; } return out; }, {});
		output = output.concat(_.map(_.pick(nonEmptySpecified, deps), function(dep, name) {
			var comment = '';
			if (_this.isCircular(String(dep))) {
				comment = 'WARNING: CURCULAR DEPENDENCY';
			}

			return { name: name, path: dep, comment: comment, plugin: '' };
		}));
		deps = _.difference(deps, _.keys(nonEmptySpecified));

		// Add other needed modules:
		var project = this.getProject();
		var availableModules = project.getModules();
		output = output.concat(_.map(_.pick(availableModules, deps), function(dep, name) {
			var comment = '';
			if (_this.isCircular(dep)) {
				comment = 'WARNING: CURCULAR DEPENDENCY';
			}

			return { name: name, path: dep, comment: comment, plugin: '' };
		}));
		deps = _.difference(deps, _.keys(availableModules));

		// Add unknown modules:
		output = output.concat(_.map(deps, function(name) {
			return { name: name, path: '', comment: '<-- '+name+' not found. Manually add and redo jsimports', plugin: '' };
		}));

		this._resolvedDependencies = _.sortBy(output, this.sortFunc);
	}
	return this._resolvedDependencies;
};


File.prototype.getNewDefineSection = function() {
	var deps = this.getResolvedDependencies();
	var anonymous = this.getAnonymousDependencies();

	var prepend = 'define(['+"\n\t";
	var prepend_ = '], function(';

	var pathsSeparator = ",\n\t";
	var pathsNewlineSeparator = ",\n\n\t";
	var namesSeparator = ",\n            ";
	var namesNewlineSeparator = ",\n\n            ";

	var prev = null;
	_.each(deps, function(dep) {
		var curr = dep.path;
		if (curr.split('!').length > 1) {
			curr = _.rest(dep.path.split('!')).join('!');
		}
		curr = curr.split('/').slice(0, -1).slice(0, 1).join('/');

		if (prev !== null) {
			if (prev != curr) {
				prepend = prepend.substr(0, prepend.length - pathsSeparator.length) + pathsNewlineSeparator;
				prepend_ = prepend_.substr(0, prepend_.length - namesSeparator.length) + namesNewlineSeparator;
			}
		}
		prev = curr;

		var comment = '';
		if (dep.comment) {
			comment = ' /* '+dep.comment+' */';
		}
		
		prepend += "'"+ dep.path +"'"+comment+",\n\t";
		prepend_ += dep.name + ",\n            ";
	});

	if (anonymous.length > 0) {
		if (deps.length > 0) {
			prepend = prepend.substr(0, prepend.length - 1);
		}

		prepend += "\n\t// anonymous dependencies:\n\t";
		_.each(anonymous, function(dep) {
			prepend += "'"+ dep +"',\n\t";
		});
	}
	
	if (deps.length == 0 && anonymous.length == 0) {
		prepend = 'define([], function() {';
	} else {
		prepend = prepend.substr(0, prepend.length-3)+"\n";
		prepend += prepend_;

		if (deps.lenght == 0) {
			prepend = prepend + ') {';
		} else {
			prepend = prepend.substr(0, prepend.length-14)+') {';
		}
	}

	return prepend;
};

/**
 * Sorts dependencies so that they are grouped by directories. Those
 * without any "/" should go first
 */
File.prototype.sortFunc = function(dep) {
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
};


/**
 * Represents a AMD module project. Reads jsimports.json, detects
 * modules and can also read RequireJS config to get external libs and
 * shims.
 */
function Project(pathInsideProject) {
	this.defaultConfig = {
		requirejsConfig: null,
		basePath: null,
		excludeDirs: []
	};

	/**
	 * Cached config
	 */
	this._config = null;

	/**
	 * Cached list of all files. Keys in the object are resolved
	 * paths, and values are File objects
	 */
	this._files = {};

	/**
	 * Resolved path to somewhere inside this project
	 */
	this._path = path.resolve(pathInsideProject);

	/**
	 * Modules from requirejs
	 */
	this._modulesFromRequirejsConfig = null;

	/**
	 * All modules in project
	 */
	this._modules = null;
}


Project.prototype.resolvePath = function(pathToFile) {
	var config = this.getConfig();
	var ext = '.js';

	var pos = pathToFile.indexOf('!');
	if (pos != -1) {
		var parts = pathToFile.split('!');
		var plugin = parts.shift();

		var plugins = _.keys(config.plugins);
		if (plugins[plugin]) {
			ext = plugins[plugin];
		} else {
			parts.unshift(plugin);
		}

		pathToFile = parts.join('!');
	}

	if (!pathToFile.substr(pathToFile.length - ext.length) == ext){
		pathToFile += ext;
	}
	return path.resolve(config.basePath, pathToFile);
};


/**
 * Returns a File from the given path.
 */
Project.prototype.getFile = function(pathToFile) {
	var config = this.getConfig();

	pathToFile = this.resolvePath(pathToFile);

	if (!this._files[pathToFile]) {
		try {
			var file = new File(pathToFile, this);
			if (file.isModule() || file.isPlugin()) {
				return this._files[pathToFile] = file;
			}
		} catch (err) {
			return false;
		}
	}

	return this._files[pathToFile];		
};


/**
 * Tries to find config file and read it and extend this.config
 */
Project.prototype.readConfig = function() {
	var configPath = path.dirname(this.path)+'/'+CONFIG_FILENAME;

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
		config = _.extend(this.defaultConfig, config);

		if (config.requirejsConfig !== null) {
			config.requirejsConfig = path.resolve(path.dirname(configPath), config.requirejsConfig);
		}
		if (config.basePath !== null) {
			config.basePath = path.resolve(path.dirname(configPath), config.basePath);
		}

		return config;
	} catch (err) {
		throw {
			name: 'InvalidConfigError',
			message: 'Could not parse jsimports config file. Error:' + err
		};
	}
};


Project.prototype.getModulesFromRequirejsConfig = function() {
	if (this._modulesFromRequirejsConfig === null) {
		var config = this.getConfig();

		if (config.requirejsConfig === null) {
			this._modulesFromRequirejsConfig = {};
			return {};
		}

		var options = {};
		require.config = function(configObj) {
			options = configObj;
		};
		// THIS MAY BE VERY HARMFUL:
		eval(fs.readFileSync(config.requirejsConfig, 'utf-8'));
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

		this._modulesFromRequirejsConfig = shims;
	}

	return this._modulesFromRequirejsConfig;
};


/**
 * Finds all modules in base path
 */
Project.prototype._findModules = function() {
	var _this = this;
	var config = this.getConfig();
	var files = [];

	var extensions = ['.js'];
	extensions = extensions.concat(_.values(config.plugins));

	diveSync(config.basePath, function(err, file) {
		if (_.any(extensions, function(ext) { return file.substr(file.length - ext.length) == ext; })) {
			files.push(file);
		}
	});

	files = _.filter(files, function(file) {
		try {
			var f = new File(file);
			if (f.isModule() || f.isPlugin()) {
				_this._files[file] = f;
				return true;
			}
			return false;
		} catch (err) {
			return false;
		}
	});

	files = _.reduce(files, function(files, file) {
		var ext = '.js';
		var plugin = false;
		if (_this._files[file]) {
			plugin = _this._files[file].isPlugin();
		}
		if (plugin) {
			ext = config.plugins[plugin];
		}

		var clss = file.split("/").pop();
		clss = clss.substr(0, clss.length-ext.length);

		var path = file.substr(0, file.length-ext.length);
		path = path.substr(config.basePath.length + 1);

		if (!_.any(config.excludeDirs, function(dir) {
			return path.indexOf(dir) == 0;
		})) {
			if (plugin) {
				path = plugin+'!'+path;
			}

			files[clss] = path;
		}

		return files;
	}, {});

	this.files = _.extend(this.files, files);
	return files;
};


/**
 * Returns the project config
 */
Project.prototype.getConfig = function() {
	if (this._config === null) {
		this._config = this.readConfig();
	}

	return this._config;
};


/**
 * Returns all available modules in project. In the returned object,
 * the keys are module names and values are paths.
 */
Project.prototype.getModules = function() {
	if (this._modules === null) {
		var config = this.getConfig();
		var requirejsConfigModules = this.getModulesFromRequirejsConfig();
		var otherModules = this._findModules();
		this._modules = _.extend(otherModules, requirejsConfigModules);
	}
	return this._modules;
};


module.exports = {
	File: File,
	Project: Project
};
