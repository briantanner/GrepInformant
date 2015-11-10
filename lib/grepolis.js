var _ = require('underscore'),
	urlencode = require('urlencode'),
	async = require('async'),
	http = require('http'),
	zlib = require('zlib'),
	util = require('util'),
	url = "http://%s.grepolis.com/data/%s.txt.gz";

var keys = {
  alliances:        "id,name,points,towns,members,rank",
  players:          "id,name,alliance,points,rank,towns",
  towns:            "id,player,name,x,y,islandNo,points,ocean",
  islands:          "id,x,y,type,availableSpots,ocean",
  conquers:         "town,time,newPlayer,oldPlayer,newAlly,oldAlly",
  player_kills_all: "rank,id,points",
  player_kills_att: "rank,id,points",
  player_kills_def: "rank,id,points"
};

function parseData (endpoint, data) {
  var dataArray = [],
    lines = data.split("\n"),
    _keys = keys[endpoint].split(',');

  lines.forEach(function (row) {
    if (row.length) {
      row = row.split(',');
      dataArray.push(_.object(_keys, row));
    }
  });

  return dataArray;
}

exports.parseData = parseData;

function getData (server, endpoint, callback) {
  var _url = util.format(url, server, endpoint);

  http.get(_url, function (res) {
    var gunzip = zlib.createUnzip(),
      output = "";

    res.pipe(gunzip);

    gunzip.on('data', function (data) {
      output += data.toString();
    });

    gunzip.on('end', function () {
      return callback(null, parseData(endpoint, output));
    });

  }).on('error', function (e) {
    return callback(e);
  });
}

exports.getData = getData;

function parseName(name) {
  return urlencode.decode(name).replace(/\+/g, ' ');
}

exports.getTowns = function (server, callback) {

  getData(server, 'towns', function (err, data) {
    if (err) { return callback(err); }
    var towns = {};

    _.each(data, function (o) {
      towns[o.id] = o;
    });

    return callback(null, towns);
  });

};

exports.getIslands = function (server, callback) {
	getData(server, 'islands', function (err, data) {
		if (err) { return callback(err); }
		return callback(null, data);
	});
};

exports.getPlayers = function (server, callback) {

  getData(server, 'players', function (err, data) {
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

	getData(server, stat, function (err, data) {
		if (err) { return callback(err); }
		var players = {};

		_.each(data, function (o) {
			players[o.id] = o;
		});

		return callback(null, players);
	})

};

exports.getAlliances = function (server, callback) {

  getData(server, 'alliances', function (err, data) {
    if (err) { return callback(err); }
    var alliances = {};

    data = _.sortBy(data, function (o) { return parseInt(o.rank, 10); });

    _.each(data, function (o) {
      alliances[o.id] = o;
    });

    return callback(null, alliances);
  });

};

exports.getAllianceTowns = function (server, alliance, ocean, callback) {

	async.waterfall([

		function (callback) {
			exports.getPlayers(server, function (err, data) {
				if (err) { return callback(err); }

				data = _.reject(data, function (o) { return parseInt(o.alliance,10) !== parseInt(alliance,10); });
				data = _.indexBy(data, 'id');

				return callback(null, {players: data});
			});
		},

		function (data, callback) {
			exports.getIslands(server, function (err, _data) {
				if (err) { return callback(err); }
				var islands = {};
				
				_.each(_data, function (o) {
					islands[util.format('%sx%s', o.x, o.y)] = o;
				});

				return callback(null, _.extend(data, {islands: islands}));
			});
		},

		function (data, callback) {
			var players = data.players,
				islands = data.islands;

			exports.getTowns(server, function (err, towns) {
				if (err) { return callback(err); }
				
				var playerIds = _.pluck(players, 'id');

				towns = _.reject(towns, function (o) { return _.indexOf(playerIds, o.player) === -1; });
				towns = _.map(towns, function (o) {
					var islandXy = util.format('%sx%s', o.x, o.y),
						island = islands[islandXy];

					o.playerId = parseInt(players[o.player].id,10);
					o.allianceId = parseInt(players[o.player].alliance,10);
					o.playerName = parseName(players[o.player].name);
					o.islandId = island.id;
					o.islandXy = islandXy;
					o.ocean = parseInt(util.format('%s%s', o.x.substring(0,1), o.y.substring(0,1)));

					return o;
				});

				if (ocean) {
					towns = _.reject(towns, function (o) { return o.ocean !== ocean });
				}

				delete data;

				return callback(null, towns);
			});
		}

	], function (err, data) {
		if (err) { return callback(err); }
		return callback(null, data);
	});

};

exports.getConquers = function (server, callback) {
	
	getData(server, 'conquers', function (err, data) {
        if (err) { return callback(err); }
        return callback(null, data);
    });

};