const babylon = require('babylon');

const output = babylon.parse('import myVar from "hello";', {
	sourceType: 'module',

	plugin: [
		'asyncFunctions',
		'jsx',
		'flow',
	],
});


console.log(output.tokens);
