var assert = require('assert');
var analyzer = require("../analyzer")

describe('Analyzer', function(){
	describe('isModule', function(){
		it('should return true on valid RequireJS modules', function(){
			assert.equal(true, analyzer.isModule(analyzer.getSourceTree('define([], function() {});')));
		});

		it('should return false on invalid RequireJS modules', function(){
			assert.equal(false, analyzer.isModule(analyzer.getSourceTree('echo "hello";')));
		});
	});
});
