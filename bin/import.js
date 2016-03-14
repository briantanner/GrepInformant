'use strict';

let _ = require('underscore'),
    logger = require('../lib/logger'),
    Import = require('../lib/import'),
    arg = process.argv[2];

Import.init(arg || 'hourly', (err, result) => {
	if (err) {
    logger.error(err);
  }
	logger.info('Exiting import.');
});