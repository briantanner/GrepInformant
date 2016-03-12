'use strict';

var _ = require('underscore'),
    logger = require('../lib/logger'),
    Import = require('../lib/import');

var arg = process.argv[2];

Import.init(arg || 'hourly', function (err, result) {
	if (err) { console.error(err); }
	console.log(result);
});