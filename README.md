# jsimports

![Build status](https://api.travis-ci.org/KnutHelland/jsimports.svg)

This is a node program that analyzes a js source file (and a RequireJS project) and auto inserts these lines:

```js
define([
	'jquery',
	'underscore',

	'global/DetachableSubRouter',

	'modules/moduleadmin/views/ListModulesView',
	'modules/moduleadmin/views/ListPartnersView'
], function($,
            _,

            DetachableSubRouter,

            ListModulesView,
            ListPartnersView) {
```

So when I start on a new file within my heavy RequireJS project, I write:

```js
define([], function() {

	return DetachableSubRouter.extend({

		initialize: function() {
			var sorted = _.sort([2, 4, 7, 2]);

			$('body').append(sorted);
			var listView = new ListModulesView();
			var otherView = new ListPartnersView();
		}

	});
});
```
And hits `C-x M-j` (because I've also made a Emacs plugin), and the result is:

```js
define([
	'jquery',
	'underscore',

	'global/DetachableSubRouter',

	'modules/moduleadmin/views/ListModulesView',
	'modules/moduleadmin/views/ListPartnersView'
], function($,
            _,

            DetachableSubRouter,

            ListModulesView,
            ListPartnersView) {

	return DetachableSubRouter.extend({

		initialize: function() {
			var sorted = _.sort([2, 4, 7, 2]);

			$('body').append(sorted);
			var listView = new ListModulesView();
			var otherView = new ListPartnersView();
		}

	});
});
```

This is already really fast (feels like it happens immediately), but there's still lots of things that can be optimized.

## Installing:

```bash
sudo npm install jsimports -g
```

## Configuring

Somwhere in a directory above your source-file, you'll have to place a configuration file with the name `jsimports.json`:

```json
{
	"config": "./js/config/config.js",
	"basePath": "./js/",
	"excludeDirs": [
		"lang",
		"nls"
	]	
}
```

**config**: Path to your requireJS config file (where paths and shims are set up)

**basePath**: Base path to your javascript files

**excludeDirs**: If some directories inside basePath should be ignored

*(all paths should be relative to the jsimports.json file)*


## Running:

```bash
# This command just prints out the new file
jsimports MyModule.js

# And this command rewrites the MyModule.js file:
jsimports MyModule.js -w
```
