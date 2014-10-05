var assert = require('assert');
var jsanalyzer = require("../jsanalyzer")

describe('jsfile', function(){
	describe('getTree', function(){
		it('should return a tree for a valid file', function(){
			var err = null;
			try {
				var file = new jsanalyzer.jsfile(__dirname + '/examples/modules/MyModule.js');
				file.getTree();
			} catch (e) {
				err = e;
			}
			assert.equal(null, err);
		});

		it('should return error when file is invalid', function(){
			var err = null;
			try {
				var file = new jsanalyzer.jsfile(__dirname + '/examples/modules/MyInvalidJsModule.js');
				file.getTree();
			} catch (e) {
				err = e;
			}
			assert.notEqual(null, err);
		});
	});


	describe('isModule', function(){
		it('should return true for valid module', function(){
			var file = new jsanalyzer.jsfile(__dirname + '/examples/modules/MyModule.js');
			assert.equal(true, file.isModule());
		});

		it('should return false for non module', function(){
			var file = new jsanalyzer.jsfile(__dirname + '/jsanalyzer.js');
			assert.equal(false, file.isModule());
		});
	});



});


describe('jsanalyzer', function(){
	describe('constructor', function() {
		it('finds and reads config', function() {
			var analyzer = new jsanalyzer.jsanalyzer(__dirname + '/examples/modules/MyModule.js');
			assert.equal(true, /config\/config\.js$/.test(analyzer.config.config));
		});

		it('throws error when config is not present', function() {
			var error = null;
			try {
				var analyzer = new jsanalyzer.jsanalyzer(__filename);
			} catch (err) {
				error = err;
			}
			assert.equal('ConfigNotFoundError', error.name);
		});

		it('reads requirejs config if present', function() {
			var analyzer = new jsanalyzer.jsanalyzer(__dirname + '/examples/modules/MyModule.js');
			assert.equal('jquery', analyzer.modulesFromConfig.$);
		});
	});
});
