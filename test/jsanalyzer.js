var assert = require('assert');
var jsimports = require("../jsanalyzer");
var CircularJSON = require('circular-json');


describe('Project', function() {
	describe('getConfig', function() {
		it('should find config even when jsimports is called from outside project', function(done) {
			var exec = require('child_process').exec;

			var opts = {
				cwd: '/'
			};

			exec('node '+__dirname+'/../cli.js '+__dirname+'/examples/modules/MyModule.js', opts, function (error, stdout, stderr) {
				assert.equal(error, null);
				done();
			});
		});
	});




});

describe('File', function() {

	describe('getTree', function() {
		it('should return a tree for a valid file', function() {
			var err = null;
			try {
				var file = new jsimports.File(__dirname + '/examples/modules/MyModule.js');
				file.getTree();
			} catch (e) {
				err = e;
			}
			assert.equal(null, err);
		});

		it('should return error when file is invalid', function() {
			var err = null;
			try {
				var file = new jsimports.File(__dirname + '/examples/modules/MyInvalidJsModule.js');
				file.getTree();
			} catch (e) {
				err = e;
			}
			assert.notEqual(null, err);
		});
	});


	describe('isModule', function() {
		it('should return true for valid module', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/MyModule.js');
			assert.equal(true, file.isModule());
		});

		it('should return false for non module', function() {
			var file = new jsimports.File(__filename);
			assert.equal(false, file.isModule());
		});

		it('should return false for invalid js file', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/MyInvalidJsModule.js');
			assert.equal(false, file.isModule());
		});

		it('should return false for js file starting with require', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/FileStartingWithRequire.js');
			assert.equal(false, file.isModule());
		});

		it('should return true for module starting with comment', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/MyModuleWithLeadingComment.js');
			assert.equal(true, file.isModule());
		});
	});

	describe('getTree', function() {
		it('should return expected tree structure', function() {

			var file = new jsimports.File(__dirname + '/examples/modules/MyModule.js');
			var expectedTree = JSON.stringify({"type":"Program","body":[{"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"Identifier","name":"define"},"arguments":[{"type":"ArrayExpression","elements":[]},{"type":"FunctionExpression","id":null,"params":[],"defaults":[],"body":{"type":"BlockStatement","body":[{"type":"ReturnStatement","argument":{"type":"Literal","value":"","raw":"''"}}]},"rest":null,"generator":false,"expression":false}]}}]});
			assert.equal(expectedTree, JSON.stringify(file.getTree()));
		});
	});

	describe('getScopes', function() {
		it('should return expected scopes structure', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/MyModule.js');
			var expectedTree = JSON.stringify([{"type":"global","set":{"__data":{}},"taints":{"__data":{}},"dynamic":true,"block":{"type":"Program","body":[{"type":"ExpressionStatement","expression":{"type":"CallExpression","callee":{"type":"Identifier","name":"define"},"arguments":[{"type":"ArrayExpression","elements":[]},{"type":"FunctionExpression","id":null,"params":[],"defaults":[],"body":{"type":"BlockStatement","body":[{"type":"ReturnStatement","argument":{"type":"Literal","value":"","raw":"''"}}]},"rest":null,"generator":false,"expression":false}]}}]},"through":[{"identifier":"~0~block~body~0~expression~callee","from":"~0","tainted":false,"resolved":null,"flag":1}],"variables":[],"references":["~0~through~0"],"left":null,"variableScope":"~0","functionExpressionScope":false,"directCallToEvalScope":false,"thisFound":false,"upper":null,"isStrict":false,"childScopes":[{"type":"function","set":{"__data":{"$arguments":{"name":"arguments","identifiers":[],"references":[],"defs":[],"tainted":false,"stack":true,"scope":"~0~childScopes~0"}}},"taints":{"__data":{"$arguments":true}},"dynamic":false,"block":"~0~block~body~0~expression~arguments~1","through":[],"variables":["~0~childScopes~0~set~__data~$arguments"],"references":[],"left":null,"variableScope":"~0~childScopes~0","functionExpressionScope":false,"directCallToEvalScope":false,"thisFound":false,"upper":"~0","isStrict":false,"childScopes":[]}],"implicit":{"set":{"__data":{}},"variables":[]}},"~0~childScopes~0"]);
			assert.equal(expectedTree, CircularJSON.stringify(file.getScopes()));
		});
	});


	describe('getSpecifiedDependencies', function() {
		it('should return correct dependency list', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/MyOtherModule.js');
			assert.equal(JSON.stringify({ MyVerySpecial: 'myVerySpecial' }), JSON.stringify(file.getSpecifiedDependencies()));

			file = new jsimports.File(__dirname + '/examples/modules/MyModule.js');
			assert.equal(JSON.stringify({}), JSON.stringify(file.getSpecifiedDependencies()));
		});

		it('should also return modules with empty path', function() {
			var file = new jsimports.File(__dirname + '/examples/modules/ModuleWithEmptyDeps.js');
			assert.equal(JSON.stringify({"hei":"","hallo":"","last":"test"}), JSON.stringify(file.getSpecifiedDependencies()));
		});

	});


	describe('getNewDefineSection', function() {
		it('should return correct on empty list', function() {
			var file = new jsimports.File;
			file._resolvedDependencies = [];
			file._anonymousDependencies = [];

			assert.equal('define([], function() {', file.getNewDefineSection());
		});

		it.skip('should return correct on one dependency', function() {
			var file = new jsimports.File;
			file._resolvedDependencies = [
				{ name: 'MyModule', path: 'path/to/MyModule', comment: 'helloworld', module: '' }
			];
			file._anonymousDependencies = [];

			assert.equal(
"define([\
	'path/to/MyModule' /* helloworld */\
], function(MyModule) {", file.getNewDefineSection());
		});

		it.skip('should return correct on two dependencies', function() {
			var file = new jsimports.File;
			file._resolvedDependencies = [
				{ name: '$', path: 'jquery', comment: '', module: '' },
				{ name: '_', path: 'underscore', comment: '', module: '' }
			];
			file._anonymousDependencies = [];

			assert.equal(
"define([\
	'jquery',\
	'underscore'\
], function($,\
            _) {", file.getNewDefineSection());
		});

	});
});


// describe('jsimports', function(){
// 	describe('constructor', function() {
// 		it('finds and reads config', function() {
// 			var analyzer = new jsimports.Project(__dirname + '/examples/modules/MyModule.js');
// 			assert.equal(true, /config\/config\.js$/.test(analyzer.config.config));
// 		});

// 		it('throws error when config is not present', function() {
// 			var error = null;
// 			try {
// 				var analyzer = new jsimports.Project(__filename);
// 			} catch (err) {
// 				error = err;
// 			}
// 			assert.equal('ConfigNotFoundError', error.name);
// 		});

// 		it('reads requirejs config if present', function() {
// 			var analyzer = new jsimports.Project(__dirname + '/examples/modules/MyModule.js');
// 			assert.equal('jquery', analyzer.modulesFromConfig.$);
// 		});
// 	});
// });
