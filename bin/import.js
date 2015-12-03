var _ = require('underscore'),
    Import = require('../lib/import')

Import.init('hourly', function (err, result) {
	if (err) { console.error(err); }
	console.log(result)
});