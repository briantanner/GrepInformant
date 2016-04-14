'use strict';

const _ = require('underscore');
const Import = require('../lib/import');

let arg = process.argv[2],
    importer = new Import(arg || 'hourly');

importer.start().then(() => {
  console.log("Exiting import");
  process.exit();
})
.catch(err => {
  console.error(err);
  process.exit();
});