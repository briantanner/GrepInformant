var _ = require('underscore'),
  pg = require('pg'),
  util = require('util'),
  urlencode = require('urlencode'),
  async = require('async'),
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

function select (query, callback) {

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

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });

};

exports.islands = function (req, res) {
  var query = "select * from islands";

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.alliances = function (req, res) {
  var server = req.params.server,
      query = "select * from alliances order by rank asc";

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.players = function (req, res) {
  var server = req.params.server,
      query = "select * from players order by rank asc";

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.player = function (req, res) {
  var server = req.params.server,
      query = util.format("select * from players where id = %s", req.params.playerId);

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.map = function (req, res) {
  var server = req.params.server,
      playerId = req.params.playerId || null,
      allyId = req.query.alliance || null;

  async.waterfall([

    function (callback) {
      var query = "select t.id, t.name, t.points, t.x, t.y, t.islandNo, p.name as player, i.type, o.offsetx, o.offsety from towns t inner join players p on t.player = p.id";
          query += " inner join islands i on t.x = i.x and t.y = i.y inner join offsets o on i.type = o.id and t.islandNo = o.pos";
      
      if (playerId) query += util.format(" where t.player = '%s'", playerId);
      if (allyId) query += util.format(" where p.alliance = %s", allyId);
      
      select({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, result.rows);
      });
    },

    function (towns, callback) {
      var query = "select t.id, t.name, t.points, t.x, t.y, t.islandNo, p.name as player, i.type, o.offsetx, o.offsety from towns t left join players p on t.player = p.id";
          query += " inner join islands i on t.x = i.x and t.y = i.y inner join offsets o on i.type = o.id and t.islandNo = o.pos";
          query += " where t.player = 0 and t.points > 1200";

      select({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        towns = towns.concat(result.rows);
        return callback(null, towns);
      });
    }

  ], function (err, towns) {
    if (err) { return res.send(500, err); }
    towns = _.map(towns, function (o) {
      // Island_X = x-coordinate from islands.txt * 128
      // Island_Y = y-coordinate from islands.txt * 128 if x is even
      // Island_Y = 64 + y-coordinate from islands.txt * 128 if x is odd
      if (!o.player) o.player = 'ghost';
      o.exactX = ( ((o.x * 128) + o.offsetx) / 128 );
      o.exactY = ( ((o.y * 128) + o.offsety) / 128 );// : ( (((64 + o.y) * 128) + o.offsety) / 128 );

      return o;
    });
    // return res.send(200, towns);
    return res.render('map', { towns: towns });
  });
};

exports.offsets = function (req, res) {
  var query = "select * from offsets";

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};
