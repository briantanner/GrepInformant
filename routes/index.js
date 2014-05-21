
/*
 * GET home page.
 */

var utils = require('Grepolis-Utils');

exports.index = function(req, res) {
  res.render('index', { title: 'Grepolis Departure Time Calculator' });
};

exports.calculate = function (req, res) {
  if (!req.body) { return res.send(500, 'No travel or arrival time provided.'); }
  if (!req.body.travel || !req.body.travel.length) { return res.send(500, 'No travel time provided'); }
  if (!req.body.arrival || !req.body.arrival.length) { return res.send(500, 'No arrival time provided'); }

  var time = utils.getDepartureTime(req.body.travel, req.body.arrival);

  res.render('index', { title: 'Grepolis Departure Time Calculator', departure: time });
};