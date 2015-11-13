var _ = require('underscore'),
	Import = require('../lib/import');

Import.do('us46', function (err, result) {
	if (err) { console.error(err); }
	console.log(result);
});