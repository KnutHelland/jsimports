# jsimports

This is a node program that analyzes a js source file (and a RequireJS
project) and auto inserts these lines:

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

And this happens very fast and completely automatically.

## Running:

```bash
# This command just prints out the new file
jsimports MyModule.js

# Ant this command rewrites the MyModule.js file:
jsimports MyModule.js -w
```
