var _ = require('underscore'),
  pg = require('pg'),
  util = require('util'),
  urlencode = require('urlencode'),
  async = require('async'),
  crypto = require('crypto'),
  accounting = require('accounting'),
  grepolis = require('../lib/grepolis');
  config = require('../config.json'),
  defaults = { title: 'Grepolis Tools' };

require('dotenv').load();

var dbString = process.env.DATABASE_URL;

var pgConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: true
};

function parseName(name) {
  return urlencode.decode(name).replace(/\+/g, ' ');
}

function getDefaultData(server, callback) {
  
  async.waterfall([

    function (callback) {
      grepolis.getPlayers(server, function (err, players) {
        if (err) { return callback(err); }
        var data = {};
        data.players = players;
        return callback(null, data);
      });
    },

    function (data, callback) {
      grepolis.getAlliances(server, function (err, alliances) {
        if (err) { return callback(err); }
        data.alliances = alliances;
        return callback(null, data);
      });
    },

    function (data, callback) {
      grepolis.getTowns(server, function (err, towns) {
        if (err) { return callback(err); }
        data.towns = towns;
        return callback(null, data);
      });
    }

    ], function (err, data) {
      return callback(err, data);
    });

}

function dbQuery (query, callback) {

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

    client.query(query, function (err, result) {
      if (err) { return callback(err); }
      done();
      pg.end();
      return callback(null, result);
    });
  });

}

exports.towns = function (req, res) {
  var server = req.params.server,
      playerId = req.params.playerId || null,
      query = "select * from towns";

  if (playerId) {
    query += util.format(" where player = '%s'", playerId);
  }

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });

};

exports.islands = function (req, res) {
  var query = "select * from islands";

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.alliances = function (req, res) {
  var server = req.params.server,
      query = "select * from alliances order by rank asc";

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.players = function (req, res) {
  var server = req.params.server,
      query = "select * from players order by rank asc";

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.player = function (req, res) {
  var server = req.params.server,
      query = util.format("select * from players where id = %s", req.params.playerId);

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.map = function (req, res) {
  var server = req.params.server,
      playerId = req.params.playerId || null,
      allyId = req.query.alliance || null,
      id = req.query.q || null;

  async.waterfall([

    // get alliances
    function (callback) {
      var query = "select * from alliances order by rank asc";

      dbQuery({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, { alliances: result.rows });
      });
    },

    function (data, callback) {
      if (!id) { return callback(null, data); }
      var query = util.format("select * from searches where id = '%s'", id);

      dbQuery({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        var row = result.rows[0];
        data.options = JSON.parse(row.options);
        return callback(null, data);
      });
    },

    // get hashed searches
    function (data, callback) {
      if (!id) { return callback(null, data); }
      var ally = data.options.ally,
          player = data.options.player,
          allyColor = data.options.allycolor,
          playerColor = data.options.playercolor;

      var query = "select t.id, t.name, t.points, t.x, t.y, t.islandNo, t.player as playerid, p.name as player, p.alliance, i.type, o.offsetx, o.offsety from towns t inner join players p on t.player = p.id";
          query += " inner join islands i on t.x = i.x and t.y = i.y inner join offsets o on i.type = o.id and t.islandNo = o.pos";

      if (ally.length) {
        query += " where p.alliance in (" + ally.join(", ") + ")";
      }
      if (player.length) {
        query += (ally.length) ? " or" : " where";
        query += " t.player in (" + player.join(", ") + ")";
      }
      console.log(query);

      dbQuery({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        data.towns = result.rows;
        
        if (allyColor.length || playerColor.length) {
          var allyColors = {},
              playerColors = {};
          
          _.each(allyColor, function (color, i) {
            allyColors[ally[i]] = color;
          });
          _.each(playerColor, function (color, i) {
            playerColors[player[i]] = color;
          });

          data.towns = _.map(data.towns, function (o) {
            o.color = '';

            if (!allyColors[o.alliance] && !playerColors[o.playerid]) { return o; }
            if (allyColors[o.alliance]) { o.color = allyColors[o.alliance]; }
            if (playerColors[o.playerid]) { o.color = playerColors[o.playerid]; }

            return o;
          });
        }

        return callback(null, data);
      });
    },

    // get players/alliances
    function (data, callback) {
      if (id) { return callback(null, data); }
      if (!playerId && !allyId) { return callback(null, data); }

      var query = "select t.id, t.name, t.points, t.x, t.y, t.islandNo, t.player as playerid, p.name as player, p.alliance, i.type, o.offsetx, o.offsety from towns t inner join players p on t.player = p.id";
          query += " inner join islands i on t.x = i.x and t.y = i.y inner join offsets o on i.type = o.id and t.islandNo = o.pos";
      
      if (playerId) query += util.format(" where t.player = '%s'", playerId);
      if (allyId) query += util.format(" where p.alliance = %s", allyId);
      
      dbQuery({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        data.towns = result.rows;
        return callback(null, data);
      });
    },

    // get ghosts
    function (data, callback) {
      var query = "select t.id, t.name, t.points, t.x, t.y, t.islandNo, t.player as playerid, p.name as player, p.alliance, i.type, o.offsetx, o.offsety from towns t left join players p on t.player = p.id";
          query += " inner join islands i on t.x = i.x and t.y = i.y inner join offsets o on i.type = o.id and t.islandNo = o.pos";
          query += " where t.player = 0 and t.points > 1200";

      dbQuery({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        data.towns = (data.towns && data.towns.length) ? data.towns.concat(result.rows) : result.rows;
        return callback(null, data);
      });
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    data.towns = _.map(data.towns, function (o) {
      // Island_X = x-coordinate from islands.txt * 128
      // Island_Y = y-coordinate from islands.txt * 128 if x is even
      // Island_Y = 64 + y-coordinate from islands.txt * 128 if x is odd
      if (!o.player) o.player = 'ghost';
      o.exactX = ( ((o.x * 128) + o.offsetx) / 128 );
      o.exactY = ( ((o.y * 128) + o.offsety) / 128 );// : ( (((64 + o.y) * 128) + o.offsety) / 128 );

      return o;
    });

    data.server = server;
    if (allyId) { data.alliance = allyId; }

    return res.render('map', data);
  });
};

exports.offsets = function (req, res) {
  var query = "select * from offsets";

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};


/* Begin API Routes */

exports.autocomplete = function (req, res) {
  var server = req.params.server,
      table = req.params.table || 'players',
      input = req.query.input.replace(/'/g, "''") || null;

  if (!input || input.length < 3) { return res.send(500, 'Input string must be at least 3 characters.'); }

  var query = util.format("select * from %s where lower(name) like lower('%s%%') order by name asc limit 10", table, input);
  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result.rows);
  });
};

exports.search = function (req, res) {
  var server = req.params.server,
      ally = req.body.ally,
      player = req.body.player;
      // allycolor = req.body.allycolor,
      // playercolor = req.body.playercolor;
    
  if (!ally.length && !player.length) { return res.send(500, 'Nothing to search'); }

  var query = "insert into searches (id, time, options) values ('%s', %d, '%s')",
      sha256 = crypto.createHash("sha1", "utf8"),
      time = Math.floor( new Date() / 1000),
      id = "",
      hashKey = time + ally.concat(player).join(",");

  sha256.update(hashKey);
  id = sha256.digest('hex');

  query = util.format(query, id, time, JSON.stringify(req.body).replace(/'/g, "''"));
  console.log(query);

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, { id: id });
  });

};
