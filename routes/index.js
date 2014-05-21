
/*
 * GET home page.
 */

var _ = require('underscore'),
  utils = require('Grepolis-Utils'),
  defaults = { title: 'Grepolis Calculators' };

exports.index = function(req, res) {
  res.render('index', defaults);
};

exports.calculate = function (req, res) {
  if (!req.body) { return res.send(500, 'Error.'); }

  if (req.body.travel && req.body.arrival) {
    var payload = _.extend(defaults, req.body, {
        departure: utils.getDepartureTime(req.body.travel, req.body.arrival)
      });
  }

  if (req.body.level) {
    var payload = _.extend(defaults, req.body, {
        culture: utils.getCps(req.body.level)
      });
  }

  if (!payload) {
    return res.send(500, 'Error.');
  }

  res.render('index', payload);
};