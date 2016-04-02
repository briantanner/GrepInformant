'use strict';

let _ = require('underscore'),
    Import = require('../lib/import'),
    arg = process.argv[2];

let importer = new Import(arg || 'hourly');

importer.start().then(() => {
  console.log('done');
  process.exit();
})
.catch(err => {
  logger.error(err);
  process.exit();
});