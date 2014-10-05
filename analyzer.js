var esprima = require('esprima');
var escope = require('escope');
var fs = require('fs');
var _ = require('underscore');
var path = require('path');
var diveSync = require('diveSync');


module.exports = {

	/**
	 * Returns config for file path
	 */
	getConfig: function(jsFilePath) {
		var configName = 'auto-define.json';
		var configPath = path.dirname(jsFilePath)+'/'+configName;

		while (!fs.existsSync(configPath)) {
			if (path.dirname(configPath) == '/') {
				console.log('Could not find any config file');
				process.exit(1);
			}

			configPath = path.resolve(path.dirname(configPath) + '/../' + configName);
		}

		var configs = JSON.parse(fs.readFileSync(configPath));
		configs.config = path.resolve(path.dirname(configPath), configs.config);
		configs.baseUrl = path.resolve(path.dirname(configPath), configs.baseUrl);
		return configs;
	},

	/**
	 * Returns true if source tree is a compatible RequireJS module
	 */
	isModule: function(sourceTree) {
		return sourceTree.body[0].expression.callee.name == 'define';
	},

	/**
	 * Generates a esprima source tree from JS source code
	 */
	getSourceTree: function(src) {
		try {
			return esprima.parse(src);
		} catch (err) {
			console.log('Invalid JS.');
			return false;
		}
	},

	/**
	 * Returns list of shims from a RequireJS config file
	 */
	getShims: function(configPath) {
		var options = {};

		require.config = function(configObj) {
			options = configObj;
		};
		// THIS MAY BE VERY HARMFUL:
		eval(fs.readFileSync(configPath, 'utf-8'));
		delete require.config;

		var shims = {};

		for (var lib in options.paths) {
			shims[lib] = lib;
		}

		for (var shim in options.shim) {
			var exports = options.shim[shim].exports;
			if (exports) {
				shims[exports] = shim;
			}
		}

		return shims;
	},

	/**
	 * Returns all modules in given base path
	 */
	getModules: function(basePath, excludeDirs) {
		var _this = this;
		var files = [];

		diveSync(basePath, function(err, file) {
			if (_this.endsWith(file, '.js')) {
				files.push(file);
			}
		});

		// Filter out files that is not AMD modules:
		files = _.filter(files, function(file) {
			try {
				var tree = esprima.parse(fs.readFileSync(file));
				return _this.isModule(tree);
			} catch (e) {
				return false;
			}
		});

		files = _.reduce(files, function(files, file) {
			var clss = file.split("/").pop();
			clss = clss.substr(0, clss.length-3);

			var path = file.substr(0, file.length-3);
			path = path.substr(basePath.length + 1);

			if (!_.any(excludeDirs, function(dir) {
				return path.indexOf(dir) == 0;
			})) {
				files[clss] = path;
			}

			return files;
		}, {});

		return files;
	},

	/**
	 * Returns true if str ends with suffix
	 */
	endsWith: function(str, suffix) {
		return str.indexOf(suffix, str.length - suffix.length) !== -1;
	},

	/**
	 * Returns all modules (shims and modules in base path
	 */
	getAllModules: function(configs) {
		var shims = this.getShims(configs.config);
		var modules = this.getModules(configs.baseUrl, configs.excludeDirs);
		modules = _.extend(modules, shims);
		return modules;
	},

	/**
	 * Sorts dependencies so that they are grouped by directories. Those
	 * without any "/" should go first
	 */
	sortFunc: function(dep) {
		var deppath = dep.path;

		if (deppath.split('!').length > 1) {
			deppath = _.rest(deppath.split('!')).join('!');
		}

		var groups = (deppath.split('/').length == 1);
		var prefix = '';
		if (groups == 1) {
			prefix = '0';
		}

		var pad = '000000000000000000000000000000';

		if (deppath.split('/').length == 1) {
			pad = '00000000000000000000000000000';
		}

		return _.reduce(deppath.split('/'), function(result, part) {
			var padded = (part + pad).slice(0, pad.length);
			return result + padded;
		}, prefix);
	},

	getNewDefineSection: function(src, configs) {
		var modules = this.getAllModules(configs);
		modules = _.extend(modules, this.getResolved(src));

		var deps = this.getDeps(src);

		var prepend = 'define(['+"\n\t";
		var prepend_ = '], function(';

		var depLines = [];
		
		_.each(deps, function(dep) {
			if (modules[dep]) {
				depLines.push({ name: dep, path: modules[dep] });
			} else {
				depLines.push({ name: dep, path: '', comment: '<-- manually insert path for '+dep });
				//console.log('Warning: Didn\'t find: '+dep);
			}
		});

		depLines = _.sortBy(depLines, this.sortFunc);

		var pathsSeparator = ",\n\t";
		var pathsNewlineSeparator = ",\n\n\t";
		var namesSeparator = ",\n            ";
		var namesNewlineSeparator = ",\n\n            ";

		var prev = null;
		_.each(depLines, function(dep) {
			var curr = dep.path;
			if (curr.split('!').length > 1) {
				curr = _.rest(dep.path.split('!')).join('!');
			}
			curr = curr.split('/').slice(0, -1).slice(0, 1).join('/');

			if (prev !== null) {
				if (prev != curr) {
					prepend = prepend.substr(0, prepend.length - pathsSeparator.length) + pathsNewlineSeparator;
					prepend_ = prepend_.substr(0, prepend_.length - namesSeparator.length) + namesNewlineSeparator;
				}
			}
			prev = curr;

			var comment = '';
			if (dep.comment) {
				comment = ' /* '+dep.comment+' */';
			}

			prepend += "'"+ dep.path +"'"+comment+",\n\t";
			prepend_ += dep.name + ",\n            ";
		});

		if (depLines.length == 0) {
			prepend = 'define([], function() {';
		} else {
			prepend = prepend.substr(0, prepend.length-3)+"\n";
			prepend += prepend_;
			prepend = prepend.substr(0, prepend.length-14)+") {";
		}

		return prepend;
	},

	/**
	 * Returns list of identifiers that the module depends on
	 */
	getDeps: function(src) {
		var tree = this.getSourceTree(src);
		if (tree == false) {
			return null;
		}
		
		if (!this.isModule(tree)) {
			console.log('File is not a AMD module');
			return false;
		}

		var scopes = escope.analyze(tree).scopes;

		// var modules = _.chain(scopes[1].variables)
		// 	    .filter(function(v) { return v.references.length != 0; })
		// 	    .pluck('name')
		// 	    .without('arguments')
		// 	    .value();

		// // console.log(scopes[1]);
		// console.log(tree.body[0].expression.arguments[1].params);

		var modules = _.keys(this.getResolved(src));

		var unresolved = _.chain(scopes[0].through)
			    .pluck('identifier')
			    .pluck('name')
			    .uniq()
			    .difference(this.defaultWindowMethods)
			    .difference(this.defaultWindowProperties)
			    .without('define')
			    .value();

		return modules.concat(unresolved);
	},

	/**
	 * Returns all existing dependencies that is in use.
	 */
	getResolved: function(src) {
		var tree = this.getSourceTree(src);
		if (tree == false) {
			return null;
		}

		if (!this.isModule(tree)) {
			console.log('File is not a AMD module');
			return false;
		}

		var scopes = escope.analyze(tree).scopes;

		var neededModules = _.chain(scopes[1].variables)
			    .filter(function(v) { return v.references.length != 0; })
			    .pluck('name')
			    .without('arguments')
			    .value();

		var paths = _.pluck(tree.body[0].expression.arguments[0].elements, 'value');
		var names = _.pluck(tree.body[0].expression.arguments[1].params, 'name');

		var modules = [];
		for (var i in names) {
			if (_.contains(neededModules, names[i])) {
				modules[names[i]] = paths[i];
			}
		}

		return modules;
	},

	/**
	 * Returns unused dependencies from RequireJS module source
	 */
	getUnused: function(src) {
		var tree = esprima.parse(src);
		var scopes = escope.analyze(tree).scopes;

		return _.chain(scopes[1].variables)
			.filter(function(v) { return v.references.length == 0; })
			.pluck('name')
			.without('arguments')
			.value();
	},

	/**
	 * Returns list of all unresolved identifiers in RequireJS module
	 */
	getUnresolved: function(src) {
		var tree = esprima.parse(src);
		var scopes = escope.analyze(tree).scopes;

		return _.chain(scopes[0].through)
			.pluck('identifier')
			.pluck('name')
			.uniq()
			.difference(this.defaultWindowMethods)
			.difference(this.defaultWindowProperties)
			.without('define')
			.value();
	},

	/**
	 * List of all browser default window properties. These should not
	 * be read as modules.
	 */
	defaultWindowProperties: ["window","Boolean","Number","JSON","DataView","ArrayBuffer","undefined","Function","Error","String","Math","WeakSet","eval","document","Intl","Object","URIError","Uint16Array","encodeURI","Array","escape","Int32Array","Int16Array","decodeURI","NaN","Uint8ClampedArray","isNaN","Infinity","external","Promise","parseFloat","unescape","WeakMap","RegExp","Uint32Array","ReferenceError","EvalError","Date","RangeError","chrome","top","isFinite","__commandLineAPI","parseInt","SyntaxError","Uint8Array","encodeURIComponent","location","Float64Array","TypeError","decodeURIComponent","Float32Array","Int8Array","webkitOfflineAudioContext","webkitAudioContext","OfflineAudioContext","AudioContext","speechSynthesis","webkitSpeechRecognitionEvent","webkitSpeechRecognitionError","webkitSpeechRecognition","webkitSpeechGrammarList","webkitSpeechGrammar","webkitRTCPeerConnection","webkitMediaStream","SpeechSynthesisUtterance","SpeechSynthesisEvent","Notification","MediaSource","XSLTProcessor","SharedWorker","MediaKeyEvent","Path2D","TimeRanges","MediaError","HTMLVideoElement","HTMLSourceElement","HTMLMediaElement","Audio","HTMLAudioElement","FontFace","MediaKeyError","HTMLDialogElement","localStorage","sessionStorage","applicationCache","webkitStorageInfo","webkitIDBTransaction","webkitIDBRequest","webkitIDBObjectStore","webkitIDBKeyRange","webkitIDBIndex","webkitIDBFactory","webkitIDBDatabase","webkitIDBCursor","indexedDB","webkitIndexedDB","crypto","WebSocket","WebKitGamepad","RTCSessionDescription","RTCIceCandidate","MediaStreamTrack","MediaStreamEvent","IDBVersionChangeEvent","IDBTransaction","IDBRequest","IDBOpenDBRequest","IDBObjectStore","IDBKeyRange","IDBIndex","IDBFactory","IDBDatabase","IDBCursorWithValue","IDBCursor","GamepadEvent","Gamepad","DeviceOrientationEvent","DeviceMotionEvent","CloseEvent","WaveShaperNode","ScriptProcessorNode","PeriodicWave","OscillatorNode","OfflineAudioCompletionEvent","MediaStreamAudioSourceNode","MediaStreamAudioDestinationNode","MediaElementAudioSourceNode","GainNode","DynamicsCompressorNode","DelayNode","ConvolverNode","ChannelSplitterNode","ChannelMergerNode","BiquadFilterNode","AudioProcessingEvent","AudioParam","AudioNode","AudioListener","AudioDestinationNode","AudioBufferSourceNode","AudioBuffer","AnalyserNode","XPathResult","XPathExpression","XPathEvaluator","XMLSerializer","XMLHttpRequestUpload","XMLHttpRequestProgressEvent","XMLHttpRequest","XMLDocument","Worker","Window","WheelEvent","WebKitPoint","WebKitCSSTransformValue","WebKitCSSMatrix","WebKitCSSFilterValue","WebKitCSSFilterRule","WebKitAnimationEvent","WebGLUniformLocation","WebGLTexture","WebGLShaderPrecisionFormat","WebGLShader","WebGLRenderingContext","WebGLRenderbuffer","WebGLProgram","WebGLFramebuffer","WebGLContextEvent","WebGLBuffer","WebGLActiveInfo","ValidityState","VTTCue","URL","UIEvent","TreeWalker","TransitionEvent","TrackEvent","TouchList","TouchEvent","Touch","TextTrackList","TextTrackCueList","TextTrackCue","TextTrack","TextMetrics","TextEvent","Text","StyleSheetList","StyleSheet","StorageEvent","Storage","ShadowRoot","Selection","Screen","SVGZoomEvent","SVGViewSpec","SVGViewElement","SVGUseElement","SVGUnitTypes","SVGTransformList","SVGTransform","SVGTitleElement","SVGTextPositioningElement","SVGTextPathElement","SVGTextElement","SVGTextContentElement","SVGTSpanElement","SVGSymbolElement","SVGSwitchElement","SVGStyleElement","SVGStringList","SVGStopElement","SVGSetElement","SVGScriptElement","SVGSVGElement","SVGRenderingIntent","SVGRectElement","SVGRect","SVGRadialGradientElement","SVGPreserveAspectRatio","SVGPolylineElement","SVGPolygonElement","SVGPointList","SVGPoint","SVGPatternElement","SVGPathSegMovetoRel","SVGPathSegMovetoAbs","SVGPathSegList","SVGPathSegLinetoVerticalRel","SVGPathSegLinetoVerticalAbs","SVGPathSegLinetoRel","SVGPathSegLinetoHorizontalRel","SVGPathSegLinetoHorizontalAbs","SVGPathSegLinetoAbs","SVGPathSegCurvetoQuadraticSmoothRel","SVGPathSegCurvetoQuadraticSmoothAbs","SVGPathSegCurvetoQuadraticRel","SVGPathSegCurvetoQuadraticAbs","SVGPathSegCurvetoCubicSmoothRel","SVGPathSegCurvetoCubicSmoothAbs","SVGPathSegCurvetoCubicRel","SVGPathSegCurvetoCubicAbs","SVGPathSeg","SVGPathSegClosePath","SVGPathSegArcRel","SVGPathSegArcAbs","SVGPathElement","SVGNumberList","SVGNumber","SVGMetadataElement","SVGMatrix","SVGMaskElement","SVGMarkerElement","SVGMPathElement","SVGLinearGradientElement","SVGLineElement","SVGLengthList","SVGLength","SVGImageElement","SVGGraphicsElement","SVGGradientElement","SVGGeometryElement","SVGGElement","SVGForeignObjectElement","SVGFilterElement","SVGFETurbulenceElement","SVGFETileElement","SVGFESpotLightElement","SVGFESpecularLightingElement","SVGFEPointLightElement","SVGFEOffsetElement","SVGFEMorphologyElement","SVGFEMergeNodeElement","SVGFEMergeElement","SVGFEImageElement","SVGFEGaussianBlurElement","SVGFEFuncRElement","SVGFEFuncGElement","SVGFEFuncBElement","SVGFEFuncAElement","SVGFEFloodElement","SVGFEDropShadowElement","SVGFEDistantLightElement","SVGFEDisplacementMapElement","SVGFEDiffuseLightingElement","SVGFEConvolveMatrixElement","SVGFECompositeElement","SVGFEComponentTransferElement","SVGFEColorMatrixElement","SVGFEBlendElement","SVGEllipseElement","SVGElement","SVGDiscardElement","SVGDescElement","SVGDefsElement","SVGCursorElement","SVGComponentTransferFunctionElement","SVGClipPathElement","SVGCircleElement","SVGAnimationElement","SVGAnimatedTransformList","SVGAnimatedString","SVGAnimatedRect","SVGAnimatedPreserveAspectRatio","SVGAnimatedNumberList","SVGAnimatedNumber","SVGAnimatedLengthList","SVGAnimatedLength","SVGAnimatedInteger","SVGAnimatedEnumeration","SVGAnimatedBoolean","SVGAnimatedAngle","SVGAnimateTransformElement","SVGAnimateMotionElement","SVGAnimateElement","SVGAngle","SVGAElement","Rect","Range","RGBColor","ProgressEvent","ProcessingInstruction","PopStateEvent","Plugin","PluginArray","PerformanceTiming","PerformanceResourceTiming","PerformanceNavigation","PerformanceMeasure","PerformanceMark","PerformanceEntry","Performance","PageTransitionEvent","OverflowEvent","Notation","NodeList","NodeIterator","NodeFilter","Node","Navigator","NamedNodeMap","MutationRecord","MutationObserver","MutationEvent","MouseEvent","MimeType","MimeTypeArray","MessagePort","MessageEvent","MessageChannel","MediaList","Location","KeyboardEvent","InputMethodContext","ImageData","ImageBitmap","History","HashChangeEvent","HTMLUnknownElement","HTMLUListElement","HTMLTrackElement","HTMLTitleElement","HTMLTextAreaElement","HTMLTemplateElement","HTMLTableSectionElement","HTMLTableRowElement","HTMLTableElement","HTMLTableColElement","HTMLTableCellElement","HTMLTableCaptionElement","HTMLStyleElement","HTMLSpanElement","HTMLShadowElement","HTMLSelectElement","HTMLScriptElement","HTMLQuoteElement","HTMLProgressElement","HTMLPreElement","HTMLParamElement","HTMLParagraphElement","HTMLOutputElement","HTMLOptionsCollection","Option","HTMLOptionElement","HTMLOptGroupElement","HTMLObjectElement","HTMLOListElement","HTMLModElement","HTMLMeterElement","HTMLMetaElement","HTMLMenuElement","HTMLMarqueeElement","HTMLMapElement","HTMLLinkElement","HTMLLegendElement","HTMLLabelElement","HTMLLIElement","HTMLKeygenElement","HTMLInputElement","Image","HTMLImageElement","HTMLIFrameElement","HTMLHtmlElement","HTMLHeadingElement","HTMLHeadElement","HTMLHRElement","HTMLFrameSetElement","HTMLFrameElement","HTMLFormElement","HTMLFormControlsCollection","HTMLFontElement","HTMLFieldSetElement","HTMLEmbedElement","HTMLElement","HTMLDocument","HTMLDivElement","HTMLDirectoryElement","HTMLDataListElement","HTMLDListElement","HTMLContentElement","HTMLCollection","HTMLCanvasElement","HTMLButtonElement","HTMLBodyElement","HTMLBaseElement","HTMLBRElement","HTMLAreaElement","HTMLAppletElement","HTMLAnchorElement","HTMLAllCollection","FormData","FocusEvent","FileReader","FileList","FileError","File","EventTarget","EventSource","Event","ErrorEvent","Element","DocumentType","DocumentFragment","Document","DataTransferItemList","DataTransfer","DOMTokenList","DOMStringMap","DOMStringList","DOMSettableTokenList","DOMParser","DOMImplementation","DOMException","DOMError","CustomEvent","Counter","CompositionEvent","Comment","ClientRectList","ClientRect","CharacterData","CanvasRenderingContext2D","CanvasPattern","CanvasGradient","CSSViewportRule","CSSValueList","CSSValue","CSSUnknownRule","CSSStyleSheet","CSSStyleRule","CSSStyleDeclaration","CSSRuleList","CSSRule","CSSPrimitiveValue","CSSPageRule","CSSMediaRule","CSSKeyframesRule","CSSKeyframeRule","CSSImportRule","CSSFontFaceRule","CSSCharsetRule","CDATASection","Blob","BeforeUnloadEvent","BarProp","AutocompleteErrorEvent","Attr","ApplicationCacheErrorEvent","ApplicationCache","SVGVKernElement","SVGMissingGlyphElement","SVGHKernElement","SVGGlyphRefElement","SVGGlyphElement","SVGFontFaceUriElement","SVGFontFaceSrcElement","SVGFontFaceNameElement","SVGFontFaceFormatElement","SVGFontFaceElement","SVGFontElement","SVGAltGlyphItemElement","SVGAltGlyphElement","SVGAltGlyphDefElement","WebKitMutationObserver","webkitURL","WebKitTransitionEvent","CSS","performance","console","devicePixelRatio","styleMedia","parent","opener","frames","self","defaultstatus","defaultStatus","status","name","length","closed","pageYOffset","pageXOffset","scrollY","scrollX","screenTop","screenLeft","screenY","screenX","innerWidth","innerHeight","outerWidth","outerHeight","offscreenBuffering","frameElement","event","clientInformation","navigator","toolbar","statusbar","scrollbars","personalbar","menubar","locationbar","history","screen"],

	/**
	 * List of all methods on the window-object. These should not be
	 * read as modules.
	 */
	defaultWindowMethods: ["toString","postMessage","close","blur","focus","onautocompleteerror","onautocomplete","ondeviceorientation","ondevicemotion","onunload","onstorage","onpopstate","onpageshow","onpagehide","ononline","onoffline","onmessage","onlanguagechange","onhashchange","onbeforeunload","onwaiting","onvolumechange","ontoggle","ontimeupdate","onsuspend","onsubmit","onstalled","onshow","onselect","onseeking","onseeked","onscroll","onresize","onreset","onratechange","onprogress","onplaying","onplay","onpause","onmousewheel","onmouseup","onmouseover","onmouseout","onmousemove","onmouseleave","onmouseenter","onmousedown","onloadstart","onloadedmetadata","onloadeddata","onload","onkeyup","onkeypress","onkeydown","oninvalid","oninput","onfocus","onerror","onended","onemptied","ondurationchange","ondrop","ondragstart","ondragover","ondragleave","ondragenter","ondragend","ondrag","ondblclick","oncuechange","oncontextmenu","onclose","onclick","onchange","oncanplaythrough","oncanplay","oncancel","onblur","onabort","onwheel","onwebkittransitionend","onwebkitanimationstart","onwebkitanimationiteration","onwebkitanimationend","ontransitionend","onsearch","getSelection","print","stop","open","alert","confirm","prompt","find","scrollBy","scrollTo","scroll","moveBy","moveTo","resizeBy","resizeTo","matchMedia","getComputedStyle","getMatchedCSSRules","webkitConvertPointFromPageToNode","webkitConvertPointFromNodeToPage","requestAnimationFrame","cancelAnimationFrame","webkitRequestAnimationFrame","webkitCancelAnimationFrame","webkitCancelRequestAnimationFrame","captureEvents","releaseEvents","btoa","atob","setTimeout","clearTimeout","setInterval","clearInterval","TEMPORARY","PERSISTENT","webkitRequestFileSystem","webkitResolveLocalFileSystemURL","openDatabase","constructor"]
};
