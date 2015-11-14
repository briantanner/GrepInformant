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

exports.player = function (req, res) {
  var server = req.params.server,
      query = util.format("select * from players where id = %s", req.params.playerId);

  console.log(query);

  select({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.map = function (req, res) {
  var playerId = req.params.playerId || null,
      query = "select * from towns";

  if (playerId) {
    query += util.format(" where player = '%s'", playerId);

    select({ text: query }, function (err, result) {
      if (err) { return res.send(500, err); }
      if (result.rowCount > 0) {
        var towns = result.rows;
        console.log(towns);
        return res.render('map', { towns: towns });
      }
    });
  }

  if (!playerId) { return res.render('map'); }
};