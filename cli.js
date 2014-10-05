var esprima = require('esprima');
var escope = require('escope');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var analyzer = require('./analyzer');
var diveSync = require('diveSync');

var inputFile = path.resolve(process.argv[2]);
var configs = analyzer.getConfig(inputFile);


// var src = fs.readFileSync(inputFile);
// var unused = analyzer.getUnused(src);
// var unresolved = analyzer.getUnresolved(src);
// var resolved = analyzer.getResolved(src);

// console.log(inputFile);
// console.log("Unused:     ", unused.join(', '));
// console.log("Unresolved: ", unresolved.join(', '));
// console.log('Resolved:   ', resolved);
// console.log();
// console.log("From: " + String(src).split('{')[0]+'{');
// console.log("To: " + analyzer.getNewDefineSection(src, inputFile+'ølk', configs));
// console.log();
// console.log();
// console.log();
// console.log();


// process.exit(0);



if (fs.lstatSync(inputFile).isDirectory()) {

	// Analyze directory
	console.log('Analyze directory ' + inputFile);

	var files = [];
	diveSync(inputFile, function(err, file) {
		if (analyzer.endsWith(file, '.js')) {

			if (analyzer.isModule(analyzer.getSourceTree(fs.readFileSync(file)))) {
				files.push(file);
			}
		}
	});

	_.each(files, function(file) {
		var src = fs.readFileSync(file);
		var unused = analyzer.getUnused(src);
		var unresolved = analyzer.getUnresolved(src);
		var resolved = analyzer.getResolved(src);

		if (unused.length + unresolved.length > 0) {
			console.log(file);
			console.log("Unused:     ", unused.join(', '));
			console.log("Unresolved: ", unresolved.join(', '));
			console.log('Resolved:   ', resolved);
			console.log();
			console.log("From: " + String(src).split('{')[0]+'{');
			console.log("To: " + analyzer.getNewDefineSection(src, configs));
			console.log();
			console.log();
			console.log();
			console.log();
		} else {
			console.log(file);
			console.log('OK!');
			console.log();
		}
	});

	process.exit(0);
}
var file = fs.readFileSync(inputFile);



// console.log('Needs:');
// console.log(analyzer.getUnresolved(file));

// console.log('Can remove:');
// console.log(analyzer.getUnused(file));

// console.log(analyzer.getShims('config/config.js'));
// console.log(analyzer.getModules('./', excludeDirs));
// console.log(analyzer.getDeps(file));

var prepend = analyzer.getNewDefineSection(file, configs);
var output = prepend + String(file).split('{').splice(1).join('{');

if (process.argv[3] == '-w') {
	if (String(output) != String(file)) {
		fs.writeFileSync(inputFile, output);
	}
	process.exit(0);
} else {
	process.stdout.write(output);
}
