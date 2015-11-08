var _ = require('underscore'),
	async = require('async'),
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

exports.getPlayersFull = function (server, callback) {

	async.waterfall([

	  function (callback) {
	    data = {};
	    
	    exports.getPlayerStats(server, 'player_kills_att', function (err, results) {
	      if (err) { return callback(err); }
	      data.abp = results;
	      return callback(null, data);
	    });

	  },

	  function (data, callback) {

	    exports.getPlayerStats(server, 'player_kills_def', function (err, results) {
	      if (err) { return callback(err); }
	      data.dbp = results;
	      return callback(null, data);
	    });

	  },

	  function (data, callback) {
	    
	    exports.getPlayers(server, function (err, players) {
	      _.map(players, function (o) {
	        o.abp = parseInt(data.abp[o.id].points,10);
	        o.dbp = parseInt(data.dbp[o.id].points,10);

	        return o;
	      });

	      return callback(null, players);
	    });

	  }

	  ], function (err, players) {
	    if (err) { return callback(err); }
	    return callback(null, players);
	  });

}

exports.getPlayerStats = function (server, stat, callback) {

	utils.getData(server, stat, function (err, data) {
		if (err) { return callback(err); }
		var players = {};

		_.each(data, function (o) {
			players[o.id] = o;
		});

		return callback(null, players);
	})

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