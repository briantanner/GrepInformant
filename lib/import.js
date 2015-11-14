var _ = require('underscore'),
  urlencode = require('urlencode'),
	async = require('async'),
	http = require('http'),
	zlib = require('zlib'),
	util = require('util'),
  pg = require('pg'),
  fs = require('fs'),
	url = "http://%s.grepolis.com/data/%s.txt.gz";

require('dotenv').load();

var pgConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: true
};

var keys = {
  alliances:        "id,name,points,towns,members,rank",
  players:          "id,name,alliance,points,rank,towns",
  towns:            "id,player,name,x,y,islandNo,points",
  islands:          "id,x,y,type,availableSpots,plus,minus",
  conquers:         "town,time,newPlayer,oldPlayer,newAlly,oldAlly",
  player_kills_all: "rank,id,points",
  player_kills_att: "rank,id,points",
  player_kills_def: "rank,id,points",
  island_offsets:   "id,offsetx,offsety,pos",
};

// one time use
// var islandOffsets = fs.readFileSync('./private/offsets.txt', 'utf8');

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
      var response = {};
      
      response.data = parseData(endpoint, output);
      response.content_length = res.headers['content-length'];

      return callback(null, response);
    });

  }).on('error', function (e) {
    return callback(e);
  });
}

function parseName(name) {
  return urlencode.decode(name).replace(/\+/g, ' ');
}

function getPlayers (server, callback) {

  getData(server, 'players', function (err, results) {
    if (err) { return callback(err); }
    
    results.data = _.map(results.data, function (o) {
      o.name = parseName(o.name);
      return o;
    });

    results.data = _.sortBy(results.data, function (o) { return parseInt(o.rank, 10); });
    
    return callback(null, results.data);
  });

}

function getPlayerStats (server, stat, callback) {

  getData(server, stat, function (err, results) {
    if (err) { return callback(err); }
    var players = {};

    _.each(results.data, function (o) {
      players[o.id] = o;
    });

    return callback(null, players);
  });

}

function getPlayersFull (server, callback) {

  async.waterfall([

    function (callback) {
      data = {};
      
      getPlayerStats(server, 'player_kills_att', function (err, results) {
        if (err) { return callback(err); }
        data.abp = results;
        return callback(null, data);
      });

    },

    function (data, callback) {

      getPlayerStats(server, 'player_kills_def', function (err, results) {
        if (err) { return callback(err); }
        data.dbp = results;
        return callback(null, data);
      });

    },

    function (data, callback) {
      
      getPlayers(server, function (err, players) {
        players = _.map(players, function (o) {
          o.abp = parseInt(data.abp[o.id].points,10);
          o.dbp = parseInt(data.dbp[o.id].points,10);
          o.alliance = o.alliance.length ? parseInt(o.alliance, 10) : 0;
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

function getTowns (server, callback) {
  getData(server, 'towns', function (err, results) {
    if (err) { return callback(err); }
    var towns = results.data;
    
    towns = _.map(towns, function(o) {
      o.name = parseName(o.name);
      o.player = (o.player && o.player.length) ? parseInt(o.player, 10) : 0;
      return o;
    });

    return callback(null, towns);
  });
}

function getIslands (server, callback) {
  getData(server, 'islands', function (err, results) {
    if (err) { return callback(err); }
    var islands = results.data;
    return callback(null, islands);
  });
}

function getAlliances (server, callback) {

  getData(server, 'alliances', function (err, results) {
    if (err) { return callback(err); }
    var alliances = results.data;

    alliances = _.map(alliances, function (o) {
      o.name = parseName(o.name);
      return o;
    });

    alliances = _.sortBy(alliances, function (o) { return parseInt(o.rank, 10); });

    return callback(null, alliances);
  });

}

function getConquers (server, callback) {
  
  getData(server, 'conquers', function (err, results) {
        if (err) { return callback(err); }
        var conquers = results.data;

        conquers = _.map(conquers, function (o) {
          o.newPlayer = (o.newPlayer && o.newPlayer.length) ? parseInt(o.newPlayer, 10) : 0;
          o.oldPlayer = (o.oldPlayer && o.oldPlayer.length) ? parseInt(o.oldPlayer, 10) : 0;
          o.newAlly = (o.newAlly && o.newAlly.length) ? parseInt(o.newAlly, 10) : 0;
          o.oldAlly = (o.oldAlly && o.oldAlly.length) ? parseInt(o.oldAlly, 10) : 0;

          return o;
        });

        return callback(null, conquers);
    });

};

function insert (config, callback) {
  var table = config.table,
      primary = config.primary || 'id',
      keys = config.keys,
      data = config.data;

  pg.connect(pgConfig, function (err, client, done) {

    var handleError = function (err, callback) {
      if (!err) return false;

      if (client) {
        done(client);
      }
      console.error(err);
      return callback(err);
    }

    if (handleError(err, callback)) return;

    var values = _.chain(data)
      .groupBy(function (el, i) { // split values into groups of 100
        return Math.floor(i/100);
      })
      .toArray() // convert to array
      .map(function (list) { // map value arrays to insert strings
        list = _.map(list, function (o) {
          if (o.name) {
            o.name = "'" + o.name.replace(/'/g, "''") + "'";
          }
          if (o.plus) {
              o.plus = "'" + o.plus + "'";
              o.minus = "'" + o.minus + "'";
            }
          return util.format('(%s)', _.values(o).join(', '));
        });
        return list.join(', ');
      }).value();

    async.waterfall([

      function (callback) {
        var q = { text: util.format("DROP TABLE IF EXISTS temp_%s; CREATE TABLE temp_%s (like %s)", table, table, table) };
        console.log(q.text);

        client.query(q, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });
      },

      function (result, callback) {

        async.eachSeries(values, function (list, cb) {

          var q = { text: util.format("INSERT INTO temp_%s (%s) VALUES %s", table, keys.join(', '), list) };

          client.query(q, function (err, result) {
            if (err) { return cb(err); }
            return cb(err, result);
          });
        }, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });

      },

      function (lastResult, callback) {
        var uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.%s = s.%s RETURNING s.%s )",
            iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(%s) WHERE t.%s IS NULL";
        
        var updateArr = [],
            updateStr = "";

        _.each(keys, function (k) {
          if (k === primary) { return; }
          updateArr.push(util.format("%s = s.%s", k.toLowerCase(), k.toLowerCase()));
        });
        updateStr = updateArr.join(', ');

        var qStr = util.format(uStr, table, updateStr, table, primary, primary, primary);
        qStr += " " + util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table, primary, primary);

        var q = { text: qStr };
        console.log(q.text);

        client.query(q, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, lastResult);
        });

      },

      function (lastResult, callback) {
        var q = { text: util.format("DROP TABLE temp_%s", table) }
        console.log(q.text);

        client.query(q, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, lastResult);
        });
      }

    ], function (err, result) {
      done();
      pg.end();

      if (err) { return callback(err); }
      return callback(null, result);
    });

  });

}

exports.do = function (server, callback) {
	
	async.waterfall([

    // import island offsets - one time use
    // function (callback) {
    //   var data = parseData("island_offsets", islandOffsets),
    //       keys = Object.keys(data[0]),
    //       config = { table: 'offsets', keys: keys, data: data };

    //   console.log(data.length);

    //   insert(config, function (err, results) {
    //     if (err) { return callback(err); }
    //     console.log(results);
    //     process.exit();
    //     return callback(null, results);
    //   });
    // },

		// import players
		function (callback) {
      getPlayersFull(server, function (err, data) {
        if (err) { return callback(err); }

        var keys = Object.keys(data[0]),
            config = { table: 'players', keys: keys, data: data };

        insert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });

      });
		},

    // import towns
    function (result, callback) {
      getTowns(server, function (err, data) {
        if (err) { return callback(err); }

        var keys = Object.keys(data[0]),
            config = { table: 'towns', keys: keys, data: data };

        insert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });

      });
    },

    // import alliances
    function (result, callback) {
      getAlliances(server, function (err, data) {
        if (err) { return callback(err); }

        var keys = Object.keys(data[0]),
            config = { table: 'alliances', keys: keys, data: data };

        insert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });
      });
    },

    // import conquers
    function (result, callback) {
      getConquers(server, function (err, data) {
        if (err) { return callback(err); }

        // Add id field and value since auto increment doesn't work without it
        data = _.map(data, function (o) {
          var tmp = { id: "nextval('conquers_id_seq')" };
          o = _.extend(tmp, o);
          return o;
        });

        var keys = Object.keys(data[0]),
            config = { table: 'conquers', keys: keys, data: data };

        insert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });
      });
    },

    // import islands
    function (result, callback) {
      getIslands(server, function (err, data) {
        if (err) { return callback(err); }

        var keys = Object.keys(data[0]),
            config = { table: 'islands', keys: keys, data: data };

        insert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        });
      });
    }

	], function (err, result) {
		if (err) { return callback(err); }
		return callback(null, result);
	});

};