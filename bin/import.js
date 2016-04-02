'use strict';

const _ = require('underscore');
const Import = require('../lib/import');

let arg = process.argv[2],
    importer = new Import(arg || 'hourly');

importer.start().then(() => {
  logger.info("Exiting import");
  process.exit();
})
.catch(err => {
  logger.error(err);
  process.exit();
});