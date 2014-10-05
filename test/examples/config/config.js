require.config({
    paths: {
        // Files from js-libs:
        jspdf: '../js-libs/jsPDF/jspdf',
        'jspdf.from_html': '../js-libs/jsPDF/jspdf.plugin.from_html',
        'jspdf.standard_fonts_metrics': '../js-libs/jsPDF/jspdf.plugin.standard_fonts_metrics',
        'jspdf.split_text_to_size': '../js-libs/jsPDF/jspdf.plugin.split_text_to_size',
        'jspdf.cell': '../js-libs/jsPDF/jspdf.plugin.cell',
        'jspdf.addimage': '../js-libs/jsPDF/jspdf.plugin.addimage',
        'jspdf.png_support': '../js-libs/jsPDF/jspdf.plugin.png_support',
        'jspdf.png':'../js-libs/jsPDF/libs/png_support/png',
        'jspdf.zlib':'../js-libs/jsPDF/libs/png_support/zlib',
        adler: '../js-libs/jsPDF/libs/adler32cs.js/adler32cs',
        deflate: '../js-libs/jsPDF/libs/deflate',
        filesaver: '../js-libs/jsPDF/libs/FileSaver.js/FileSaver',
        blob: '../js-libs/jsPDF/libs/Blob.js/Blob',
        canvg: '../js-libs/canvg/canvg',
        'rgbcolor': '../js-libs/canvg/rgbcolor',
        'stackblur': '../js-libs/canvg/stackblur',
        'backgrid/select-filter': '../js-libs/backgrid-select-filter/backgrid-select-filter',
        'backgrid/model-filter': '../js-libs/backgrid-model-filter/backgrid-model-filter',

        // Files from js-bower-libs:
	    esprima: '../js-bower-libs/esprima/esprima',
        reqLib: '../js-bower-libs/requirejs/require',
        jquery: '../js-bower-libs/jquery/jquery',
        underscore: '../js-bower-libs/underscore/underscore',
        backbone: '../js-bower-libs/backbone/backbone',
        marionette: '../js-bower-libs/backbone.marionette/lib/backbone.marionette',
        subroute: '../js-bower-libs/backbone.subroute/backbone.subroute',
        text : '../js-bower-libs/requirejs-text/text',
        nprogress: '../js-bower-libs/nprogress/nprogress',
        bootstrap: '../js-bower-libs/bootstrap/dist/js/bootstrap',
        bootbox: '../js-bower-libs/bootbox/bootbox',
        dx: 'global/dx',
        moment: '../js-bower-libs/moment/moment',
        highcharts: '../js-bower-libs/highcharts/highcharts',
        'backbone.form': '../js-bower-libs/backbone-forms/distribution.amd/backbone-forms',
        tour: '../js-bower-libs/bootstrap-tour/build/js/bootstrap-tour.min',
        backgrid: '../js-bower-libs/backgrid/lib/backgrid',
        'backgrid-paginator': '../js-bower-libs/backgrid-paginator/backgrid-paginator.min',
        totalfooter: '../js-bower-libs/backgridjs-footer-total/src/TotalFooter',
        velocity: '../js-bower-libs/velocity/jquery.velocity',
        'backgrid/filter': '../js-bower-libs/backgrid-filter/backgrid-filter.min',
        'backgrid/moment': '../js-bower-libs/backgrid-moment-cell/backgrid-moment-cell',
        'backbone.paginator': '../js-bower-libs/backbone.paginator/lib/backbone.paginator.min',
        'bootstrap/daterangepicker': '../js-bower-libs/bootstrap-daterangepicker/daterangepicker',
        hbs: '../js-bower-libs/require-handlebars-plugin/hbs',
        modelbinder: '../js-bower-libs/Backbone.ModelBinder/Backbone.ModelBinder',
        localStorage: '../js-bower-libs/Backbone.localStorage/backbone.localStorage',
        trackit: '../js-bower-libs/backbone.trackit/backbone.trackit',
    },

    shim: {
        underscore: {
            exports: "_"
        },
        bootstrap: ['jquery'],
        bootbox: {
            deps: ['jquery', 'bootstrap'],
            exports: 'bootbox'
        },
        tour: {
            deps: ['jquery', 'bootstrap'],
            exports: 'Tour'
        },
        backbone: {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
        marionette: {
            deps: ['jquery', 'underscore', 'backbone'],
            exports: 'Backbone.Marionette'
        },
        subroute: {
            deps: ['backbone'],
            exports: 'Backbone.SubRoute'
        },
        'backbone.form': {
            deps: ['backbone'],
            exports: 'Backbone.Form'
        },
        highcharts: {
            deps: ['jquery'],
            exports: "Highcharts"
        },
        backgrid: {
            deps: ['backbone'],
            exports: 'Backgrid'
        },
        modelbinder: {
	        deps: ['underscore','jquery','backbone'],
	        exports: 'ModelBinder'
        },
        'backbone.paginator': ['backbone'],
        'backgrid-paginator': {
            deps: ['backgrid']
        },
        localStorage: ['jquery', 'underscore', 'backbone'],
        'bootstrap/daterangepicker': {
            deps: ['jquery', 'bootstrap', 'moment']
        },
        'backgrid/filter': {
            deps: ['backgrid'],
        },
        'backgrid/moment': {
            deps: ['backgrid', 'moment'],
        },
	    'backgrid/select-filter': {
            deps: ['backgrid'],
        },
        'backgrid/model-filter': {
            deps: ['backgrid'],
        },
        nprogress: {
            deps: ['jquery'],
            exports: "NProgress"
        },
        moment: {
            exports: 'moment'
        },
        totalfooter: {
            exports: 'TotalFooter'
        },
        jspdf: {
            exports: 'jsPDF',
        },
        'jspdf.from_html': ['jquery', 'jspdf', 'filesaver', 'blob', 'jspdf.standard_fonts_metrics', 'jspdf.cell', 'jspdf.split_text_to_size', 'jspdf.addimage', 'deflate', 'adler'],
        'jspdf.png_support':['jspdf.png', 'jspdf.zlib'],
        'jspdf.standard_fonts_metrics': ['jspdf'],
        'jspdf.split_text_to_size': ['jspdf'],
        'jspdf.cell': ['jspdf'],
        'jspdf.addimage': ['jspdf', 'jspdf.png_support'],
        adler: ['jspdf'],
        deflate: ['jspdf'],
        filesaver: ['jspdf'],
        blob: ['jspdf'],
        velocity: {
            deps: ['jquery'],
	        exports: '$'
        },
	    jquery: {
		    exports: '$'
	    }
    }
});
