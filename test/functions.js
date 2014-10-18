var assert = require('assert');
var fn = require('../functions');
var fs = require('fs');
var _ = require('underscore');
var node_path = require('path');
var CircularJSON = require('circular-json');
var esprima = require('esprima');
var escope = require('escope');
var diveSync = require('diveSync');
var Lazy = require('lazy');


describe('assertConfig', function() {
	it('should throw error when empty config', function() {
		assert.throws(function() {
			fn.assertConfig({}, ['some']);
		}, 'MissingConfig');
	});

	it('should throw error when insuficcient config', function() {
		assert.throws(function() {
			fn.assertConfig({other: true}, ['some']);
		}, 'MissingConfig');
	});

	it('should not throw error when perfect config', function() {
		fn.assertConfig({other: true}, ['other']);
	});

	it('should not throw error when having multiple config var', function() {
		fn.assertConfig({other: true, another: false}, ['other', 'another']);
	});
});


describe('resolveProjectPath', function() {

	var config = {
		basePath: __dirname + '/examples',
		plugins: {
			hbs: '.hbs',
			a: '.another'
		}
	};

	it('works for normal module', function() {
		assert.equal(
			fn.resolveProjectPath(config, 'modules/MyModule'),
			__dirname + '/examples/modules/MyModule.js');
	});

	it('works for hbs plugin', function() {
		assert.equal(
			fn.resolveProjectPath(config, 'hbs!modules/Example'),
			__dirname + '/examples/modules/Example.hbs');
	});

	it('works for the a plugin', function() {
		assert.equal(
			fn.resolveProjectPath(config, 'a!modules/Test'),
			__dirname + '/examples/modules/Test.another');
	});

	it.skip('errors when the plugin does not exist', function() {
		fn.resolveProjectPath(config, 'nonExistingModule');
	});

});



describe('toProjectPath', function() {

	var config = {
		basePath: __dirname + '/examples',
		plugins: {
			hbs: '.hbs',
			a: '.another'
		}
	};

	it('works for normal module', function() {
		assert.equal(
			fn.toProjectPath(config, __dirname + '/examples/modules/MyModule.js'),
			'modules/MyModule');
	});

	it('works for hbs plugin', function() {
		assert.equal(
			fn.toProjectPath(config, __dirname + '/examples/modules/Example.hbs'),
			'hbs!modules/Example');
	});

	it('works for the a plugin', function() {
		assert.equal(
			fn.toProjectPath(config, __dirname + '/examples/modules/Test.another'),
			'a!modules/Test');
	});

	it.skip('errors when the plugin does not exist', function() {
		fn.toProjectPath(config, 'nonExistingModule');
	});

});


describe('treeIsModule', function() {
	it('should return true for valid module', function() {
		var tree = esprima.parse(fs.readFileSync(__dirname + '/examples/modules/MyModule.js'));
		assert.equal(fn.treeIsModule(tree), true);
	});

	it('should return false for non module', function() {
		var tree = esprima.parse(fs.readFileSync(__filename));
		assert.equal(fn.treeIsModule(tree), false);
	});

	it('should return false for js file starting with require', function() {
		var tree = esprima.parse(fs.readFileSync(__dirname + '/examples/modules/FileStartingWithRequire.js'));
		assert.equal(fn.treeIsModule(tree), false);
	});

	it('should return true for module starting with comment', function() {
		var tree = esprima.parse(fs.readFileSync(__dirname + '/examples/modules/MyModuleWithLeadingComment.js'));
		assert.equal(fn.treeIsModule(tree), true);
	});
});


describe('getEsprimaTree', function() {
	it('should return expected tree structure', function() {

		var src = fs.readFileSync(__dirname + '/examples/modules/MyModule.js');
		var expectedTree = JSON.stringify({"type":"Program","body":[{"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"Identifier","name":"define"},"arguments":[{"type":"ArrayExpression","elements":[]},{"type":"FunctionExpression","id":null,"params":[],"defaults":[],"body":{"type":"BlockStatement","body":[{"type":"ReturnStatement","argument":{"type":"Literal","value":"","raw":"''"}}]},"rest":null,"generator":false,"expression":false}]}}]});
		assert.equal(JSON.stringify(fn.getTree(src)), expectedTree);
	});
});



describe('getScopesFromTree', function() {
	it('should return expected scopes structure', function() {
		var tree = esprima.parse(fs.readFileSync(__dirname + '/examples/modules/MyModule.js'));
		var expectedTree = JSON.stringify([{"type":"global","set":{"__data":{}},"taints":{"__data":{}},"dynamic":true,"block":{"type":"Program","body":[{"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"Identifier","name":"define"},"arguments":[{"type":"ArrayExpression","elements":[]},{"type":"FunctionExpression","id":null,"params":[],"defaults":[],"body":{"type":"BlockStatement","body":[{"type":"ReturnStatement","argument":{"type":"Literal","value":"","raw":"''"}}]},"rest":null,"generator":false,"expression":false}]}}]},"through":[{"identifier":"~0~block~body~0~expression~callee","from":"~0","tainted":false,"resolved":null,"flag":1}],"variables":[],"references":["~0~through~0"],"left":null,"variableScope":"~0","functionExpressionScope":false,"directCallToEvalScope":false,"thisFound":false,"upper":null,"isStrict":false,"childScopes":[{"type":"function","set":{"__data":{"$arguments":{"name":"arguments","identifiers":[],"references":[],"defs":[],"tainted":false,"stack":true,"scope":"~0~childScopes~0"}}},"taints":{"__data":{"$arguments":true}},"dynamic":false,"block":"~0~block~body~0~expression~arguments~1","through":[],"variables":["~0~childScopes~0~set~__data~$arguments"],"references":[],"left":null,"variableScope":"~0~childScopes~0","functionExpressionScope":false,"directCallToEvalScope":false,"thisFound":false,"upper":"~0","isStrict":false,"childScopes":[]}],"implicit":{"set":{"__data":{}},"variables":[]}},"~0~childScopes~0"]);

		assert.equal(expectedTree, CircularJSON.stringify(fn.getScopesFromTree(tree)));
	});
});



describe('getSpecifiedDependencies', function() {

	it('returns correct when empty', function() {
		var tree = fn.getTree('define([], function() {});');
		assert.equal(JSON.stringify(fn.getSpecifiedDependencies(tree)), JSON.stringify({}));
	});

	it.skip('returns correct when empty and list omitted', function() {
		var tree = fn.getTree('define(function() {});');
		assert.equal(JSON.stringify(fn.getSpecifiedDependencies(tree)), JSON.stringify({}));
	});

	it('returns correct when normal', function() {
		var tree = fn.getTree('define(["one", "two"], function (three, four) {});');
		var expected = { three: 'one', four: 'two' };
		assert.equal(JSON.stringify(fn.getSpecifiedDependencies(tree)), JSON.stringify(expected));
	});

	it('returns correct with anonymous', function() {
		var tree = fn.getTree('define(["one", "two", "anonymous", "other"], function (three, four) {});');
		var expected = { three: 'one', four: 'two', 0: 'anonymous', 1: "other" };
		assert.equal(JSON.stringify(fn.getSpecifiedDependencies(tree)), JSON.stringify(expected));
	});

});


describe('getRealDependencies', function() {

	it('returns correct when empty', function() {
		var tree = fn.getTree('define([], function() {});');
		var scopes = fn.getScopesFromTree(tree);
		assert.equal(JSON.stringify(fn.getRealDependencies(tree, scopes)), JSON.stringify({}));
	});

	it.skip('returns correct when empty and list omitted', function() {
		var tree = fn.getTree('define(function() {});');
		var scopes = fn.getScopesFromTree(tree);
		assert.equal(JSON.stringify(fn.getRealDependencies(tree, scopes)), JSON.stringify({}));
	});

	it('empty module does not depend on anything', function() {
		var tree = fn.getTree('define(["one", "two"], function (three, four) {});');
		var scopes = fn.getScopesFromTree(tree);
		assert.equal(JSON.stringify(fn.getRealDependencies(tree, scopes)), JSON.stringify({}));
	});

	it('but anonymous dependencies are preserved', function() {
		var tree = fn.getTree('define(["one", "two", "anonymous", "other"], function (three, four) {});');
		var scopes = fn.getScopesFromTree(tree);
		var expected = { 0: 'anonymous', 1: "other" };
		assert.equal(JSON.stringify(fn.getRealDependencies(tree, scopes)), JSON.stringify(expected));
	});

	it('one unspecified, one specified and one anonymous', function() {
		var tree = fn.getTree('define(["one", "two", "anonymous", "other"], function (three, four) { three; fifth; });');
		var scopes = fn.getScopesFromTree(tree);
		var expected = { 0: 'anonymous', 1: 'other', fifth: "", three: "one" };
		assert.equal(JSON.stringify(fn.getRealDependencies(tree, scopes)), JSON.stringify(expected));
	});

});


describe('findFilesInProject', function() {

	var config = {
		basePath: __dirname+'/examples',
		plugins: {
			hbs: '.hbs'
		},
		excludeDirs: [
			'config'
		]
	};

	it('does not contain excluded dir', function() {
		var files = fn.findFilesInProject(config);
		assert.equal(_.contains(files, __dirname+'/examples/config/config.js'), false);
	});

	it('contains plugin files', function() {
		var files = fn.findFilesInProject(config);
		assert.equal(_.contains(files, __dirname+'/examples/modules/Example.hbs'), true);
	});

	it('contains modules', function() {
		var files = fn.findFilesInProject(config);
		assert.equal(_.contains(files, __dirname+'/examples/modules/MyModule.js'), true);
	});

	it('does not contain other files', function() {
		var files = fn.findFilesInProject(config);
		assert.equal(_.contains(files, __dirname+'/examples/modules/Test.another'), false);
	});

});
