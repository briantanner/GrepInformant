
/*
 * GET home page.
 */

var _ = require('underscore'),
  accounting = require('accounting'),
  utils = require('Grepolis-Utils'),
  defaults = { title: 'Grepolis Tools' };

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

exports.compare = function (req, res) {
  compared_alliances = [
    [20, 3222, 2243, 1759],
    [3615, 3617, 1082, 1502, 1933]
  ];

  utils.getData('us39', 'alliances', function (err, data) {
    if (err) { return; }
    var alliances = _.sortBy(data, function(o){ return parseInt(o.rank, 10); }).slice(0,30),
        compare_data = [],
        total_data = [],
        payload = {};

    compared_alliances.forEach(function(row) {
      var tmp = _.filter(alliances, function(o) { return row.indexOf(parseInt(o.id,10)) !== -1; });
      compare_data.push(tmp);
    });

    _.map(compare_data, function(row) {
      _.map(row, function(o){ o.name = o.name.replace(/\+/g,' '); return o; });

      var points = _.reduce(row, function(num,o){ return num + parseInt(o.points,10); }, 0),
          towns = _.reduce(row, function(num,o){ return num + parseInt(o.towns,10); }, 0),
          members = _.reduce(row, function(num,o){ return num + parseInt(o.members,10); }, 0),
          names = _.reduce(row, function(arr,o){ return arr.concat([o.name]); }, []),
          nameStr = names.join('/');

      var total = {
        name: nameStr,
        points: points,
        towns: towns,
        members: members,
        average: {
          points: accounting.formatNumber(points/members),
          towns: accounting.formatNumber(towns/members)
        }
      };

      row.push(total);
      total_data.push(total);

      _.map(row, function(o) {
        o.points = accounting.formatNumber(o.points);
        o.towns = accounting.formatNumber(o.towns);
        return o;
      });

      _.map(total_data, function(o) {
        o.points = accounting.formatNumber(o.points);
        o.towns = accounting.formatNumber(o.towns);
        return o;
      });

      return row;

    });

    var payload = _.extend(defaults, {alliances: total_data});

    res.render('index', payload);

  });

}