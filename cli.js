#!/usr/bin/env node


process.title = 'jsimports';

var jsimports = require('./jsanalyzer');
var _ = require('underscore');
var path = require('path');
var fs = require('fs');

function print(str) {
	process.stdout.write(str);
}
function println(str) {
	print(str+"\n");
}

var commands = {
	
	default: function(args) {
		var inputFile = path.resolve(args[0]);
		var stats = fs.statSync(inputFile);
		if (stats.isDirectory()) {
			commands.directory(args);
			process.exit(0);
		}

		if (!stats.isFile()) {
			println('File not found');
			process.exit(1);
		}

		var src = fs.readFileSync(inputFile);
		var file = new jsimports.File(inputFile);

		if (!file.isModule()) {
			print('Not a module');
			process.exit(1);
		}

		var prepend = file.getNewDefineSection();
		var output = prepend + String(src).split('{').splice(1).join('{');

		if (process.argv[3] == '-w') {
			if (String(output) != String(file)) {
				fs.writeFileSync(path.resolve(inputFile), output);
			}
			process.exit(0);
		} else {
			print(output);
		}
	},


	stats: function(args) {
		var project = new jsimports.Project(args[0]);
		project.getProjectModules();

		var getDependents = function(file, indent) {
			var deps = [];

			var tab = '';
			for (var i = 0; i < indent; i++) tab += ' ';

			_.each(project._files, function(f) {
				if (f.isModule()) {
					try {
						var deps = _.pluck(f.getResolvedDependencies(), 'path');
						deps = deps.concat(f.getAnonymousDependencies());
						if (_.contains(deps, file.getProjectPath())) {
							console.log(tab + f.getProjectPath());
							// getDependents(f, indent+4);
						}

					} catch (err) {

					}
				}
			});

			return deps;
		};

		var file = project.getFilePhysicalPath(args[0]);
		getDependents(file, 4);

	},


	directory: function(args) {
		var project = new jsimports.Project(args[0]);
		var modules = project.getProjectModules();

		_.each(modules, function(path, name) {

			var file = project.getFile(path);
			if (!file) {
				// console.log('Something wrong with', path);
			} else if (file.isModule()) {

				var prepend = file.getNewDefineSection();
				var output = prepend + String(file.src).split('{').splice(1).join('{');

				if (args[1] == '-w') {
					if (String(output) != String(file)) {
						fs.writeFileSync(file.path, output);
					}
				} else {
					if (String(file.src).split('{')[0]+'{' != file.getNewDefineSection()) {
						console.log('NO', path);
					} else {
						console.log('OK', path);
					}
				}
			}

		});
	},

	mv: function(args) {
		println('mv command not implemented yet...');
	}
};



//
// Main
//
for (var cmd in commands) {
	if (process.argv[2] == cmd) {
		commands[cmd](process.argv.slice(3));
		process.exit(0);
	}
}
// or default:
commands.default(process.argv.slice(2));
