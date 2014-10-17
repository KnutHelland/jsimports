var assert = require('assert');
var jsimports = require("../jsanalyzer");

describe('File', function() {
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
