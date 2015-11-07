var _ = require('underscore'),
	utils = require('Grepolis-Utils');

exports.getTowns = function (server, callback) {
	
  utils.getData(server, 'towns', function (err, data) {
    if (err) { return callback(err); }
    var towns = {};

    _.each(data, function (o) {
      towns[o.id] = o;
    });

    return callback(null, towns);
  });
  
};

exports.getPlayers = function (server, callback) {

  utils.getData(server, 'players', function (err, data) {
    if (err) { return callback(err); }
    var players = {};

    data = _.sortBy(data, function (o) { return parseInt(o.rank, 10); });

    _.each(data, function (o) {
      players[o.id] = o;
    });
    
    return callback(null, players);
  });

};

exports.getAlliances = function (server, callback) {

  utils.getData(server, 'alliances', function (err, data) {
    if (err) { return callback(err); }
    var alliances = {};

    data = _.sortBy(data, function (o) { return parseInt(o.rank, 10); });

    _.each(data, function (o) {
      alliances[o.id] = o;
    });

    return callback(null, alliances);
  });

};

exports.getConquers = function (server, callback) {
	
	utils.getData(server, 'conquers', function (err, data) {
        if (err) { return callback(err); }
        return callback(null, data);
    });

};