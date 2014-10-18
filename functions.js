var esprima = require('esprima');
var escope = require('escope');
var fs = require('fs');
var _ = require('underscore');
var node_path = require('path');
var diveSync = require('diveSync');
var ignore = require('./ignore.js');


/**
 * Takes a config object and a list of parameters. If a parameter does
 * not exists, then it returns a meaningful error.
 */
function assertConfig(config, params) {
	var missing = _.difference(params, _.keys(config));

	if (missing.length > 0) {
		throw {
			name: 'MissingConfig',
			message: 'Config object misses parameters ' + missing.join(', ')
		};
	}
}

/**
 * Resolves a project path and returns a absolute path. Throws an
 * error if the file does not exist.
 *
 * @param config (Required config params are: basePath and plugins)
 * @param path RequireJS path to somewhere in the project
 */
function resolveProjectPath(config, path) {
	assertConfig(config, ['basePath', 'plugins']);

	var ext = '.js';

	var pos = path.indexOf('!');
	if (pos != -1) {
		var parts = path.split('!');
		var plugin = parts.shift();

		if (_.contains(_.keys(config.plugins), plugin)) {
			ext = config.plugins[plugin];
		} else {
			parts.unshift(plugin);
		}

		path = parts.join('!');
	}

	path += ext;
	return node_path.resolve(config.basePath, path);
}


/**
 * Takes a absolute path and returns a project path
 *
 * @param config (Required config params are: basePath and plugins)
 * @param absolutePath Absolute path to a file inside the project
 */
function toProjectPath(config, absolutePath) {
	assertConfig(config, ['basePath', 'plugins']);

	var plugin = null;
	var extensionless = null;
	_.each(config.plugins, function(ext, name) {
		if (absolutePath.substring(absolutePath.length - ext.length) == ext) {
			plugin = name;
			extensionless = absolutePath.substring(0, absolutePath.length - ext.length);
		}
	});

	if (plugin == null) {
		extensionless = absolutePath.substring(0, absolutePath.length - '.js'.length);
		plugin = '';
	} else {
		plugin += '!';
	}
	return plugin + extensionless.substring(config.basePath.length + 1);
}


/**
 * Validates a esprima tree and returns true if it is a valid AMD
 * module.
 *
 * @param esprimaTree
 */
function treeIsModule(esprimaTree) {
	try {
		return esprimaTree.body[0].expression.callee.name == 'define';
	} catch (err) {}

	return false;
}



/**
 * Returns a esprima tree from valid source file or throws an error.
 *
 * @throws EsprimaParseError
 * @returns tree
 */
function getTree(src) {
	try {
		return esprima.parse(src);
	} catch (err) {
		throw {
			name: 'EsprimaParseError',
			message: 'Invalid js file (not readable by Esprima). ' + err
		};
	}
}


/**
 * Returns escope scopes from a esprima tree
 */
function getScopesFromTree(esprimaTree) {
	return escope.analyze(esprimaTree).scopes;
}


/**
 * Returns dependencies from a esprima tree
 */
function getSpecifiedDependencies(esprimaTree) {
	var paths = [];
	var names = [];

	try {
		paths = _.pluck(esprimaTree.body[0].expression.arguments[0].elements, 'value');
		names = _.pluck(esprimaTree.body[0].expression.arguments[1].params, 'name');
	} catch(err) {
		throw {
			name: 'InvalidModule',
			message: 'The tree is not a valid AMD module'
		};
	}

	var deps = {};
	var anonymousIterator = 0;
	for (var i in paths) {
		if (names[i]) {
			deps[names[i]] = paths[i];
		} else {
			deps[anonymousIterator++] = paths[i];
		}
	}

	return deps;
}


/**
 * Returns the modules that the module really should have as its
 * dependencies. Inclusive anonymous dependencies.
 *
 * @param tree
 * @param scopes
 * @returns object with dependencies
 */
function getRealDependencies(tree, scopes) {
	var realDependencies =  _.chain(scopes[0].through)
		.pluck('identifier')
		.pluck('name')
		.uniq()
		.difference(ignore)
		.value();

	var specified = getSpecifiedDependencies(tree);
	var names = _.keys(specified);

	realDependencies = realDependencies.concat(
		_.chain(scopes[1].variables)
			.filter(function(v) { return v.references.length != 0; })
			.pluck('name')
			.filter(function(n) { return _.contains(names, n); })
			.without('arguments')
			.value());

	realDependencies = _.reduce(realDependencies, function(out, dep) { out[dep] = ''; return out; }, {});

	for (var i in realDependencies) {
		if (specified[i]) {
			realDependencies[i] = specified[i];
		}
	}

	realDependencies = _.extend(realDependencies,
		_.chain(specified)
			.filter(function(v, k) { try { return String(parseInt(k)) == k; } catch (err) {} return false; })
			.values()
			.value());

	return realDependencies;
}


/**
 * Resolves a project path and returns a absolute path. Throws an
 * error if the file does not exist.
 *
 * @param config (Required config params are: basePath and plugins)
 */
function findFilesInProject(config) {
	assertConfig(config, ['basePath', 'plugins', 'excludeDirs']);

	var files = [];
	var extensions = ['.js'].concat(_.values(config.plugins));
	var excludeDirs = _.map(config.excludeDirs, function(dir) { return config.basePath+'/'+dir; });

	diveSync(config.basePath, function(err, file) {
		if (!_.any(excludeDirs, function(pre) { return file.substr(0, pre.length) == pre; })) {
			if (_.any(extensions, function(ext) { return file.substr(file.length - ext.length) == ext; })) {
				files.push(file);
			}
		}
	});

	return files;
}



module.exports = {
	assertConfig: assertConfig,
	resolveProjectPath: resolveProjectPath,
	toProjectPath: toProjectPath,
	getTree: getTree,
	treeIsModule: treeIsModule,
	getScopesFromTree: getScopesFromTree,
	getSpecifiedDependencies: getSpecifiedDependencies,
	getRealDependencies: getRealDependencies,
	findFilesInProject: findFilesInProject
};


