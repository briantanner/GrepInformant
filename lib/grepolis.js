'use strict';

var _ = require('underscore'),
    urlencode = require('urlencode'),
    http = require('http'),
    zlib = require('zlib'),
    util = require('util'),
    async = require('async'),
    logger = require('./logger'),
    Promise = require('bluebird'),
    url = "http://%s.grepolis.com/data/%s.txt.gz";

var keys = {
  alliances:        "id,name,points,towns,members,rank",
  players:          "id,name,alliance,points,rank,towns",
  towns:            "id,player,name,x,y,islandNo,points",
  islands:          "id,x,y,type,availableSpots,plus,minus",
  conquers:         "town,time,newPlayer,oldPlayer,newAlly,oldAlly,points",
  player_kills_all: "rank,id,points",
  player_kills_att: "rank,id,points",
  player_kills_def: "rank,id,points",
  alliance_kills_all: "rank,id,points",
  alliance_kills_att: "rank,id,points",
  alliance_kills_def: "rank,id,points",
  island_offsets:   "id,offsetx,offsety,pos",
};

function parseName(name) {
  return urlencode.decode(name).replace(/\+/g, ' ');
}

function parseData (server, endpoint, data) {
  var dataArray = [],
      lines = data.split("\n"),
      _keys = keys[endpoint].split(',');
  _keys.push('server');

  lines.forEach(function (row) {
    if (row.length) {
      row = row.split(',');
      row.push(server);
      dataArray.push(_.object(_keys, row));
    }
  });

  return dataArray;
}

exports.parseData = parseData;

function getData (server, endpoint) {

  return new Promise(function (resolve, reject) {
    var _url = util.format(url, server, endpoint);

    // fetch data from url
    http.get(_url, function (res) {
      if (res.headers['content-type'] !== 'application/octet-stream') {
        return resolve({});
      }

      var gunzip = zlib.createUnzip(),
          output = "";

      res.pipe(gunzip);

      gunzip.on('data', function (data) {
        output += data.toString();
      });

      gunzip.on('end', function () {
        var response = {};
        
        response.data = parseData(server, endpoint, output);
        response.content_length = res.headers['content-length'];

        return resolve(response);
      });

    }).on('error', function (e) {
      return reject(e);
    });
  });
}

exports.getData = getData;

// get player data
exports.getPlayers = function (server) {

  return new Promise(function (resolve, reject) {

    getData(server, 'players')
      .then(function (results) {
        results.data = _.map(results.data, function (o) {
          o.name = parseName(o.name);
          return o;
        });

        results.data = _.sortBy(results.data, function (o) {
          return parseInt(o.rank, 10);
        });
        
        return resolve(results.data);
      })
      .catch(reject);
  });

};

// get player stats
exports.getPlayerStats = function (server, stat) {

  return new Promise(function (resolve, reject) {
    getData(server, stat)
      .then(function (results) {
        var players = {};

        _.each(results.data, function (o) {
          players[o.id] = o;
        });

        return resolve(players);
      })
      .catch(reject);
  });
};

exports.getPlayersFull = function (server) {

  return new Promise(function (resolve, reject) {

    Promise.join(
        exports.getPlayerStats(server, 'player_kills_att'),
        exports.getPlayerStats(server, 'player_kills_def'),
        exports.getPlayers(server),
      function (abp, dbp, players) {
        // add abp/dbp to players and parse data
        players = _.map(players, function (o) {
          o.abp = (abp[o.id]) ? parseInt(abp[o.id].points,10) : 0;
          o.dbp = (dbp[o.id]) ? parseInt(dbp[o.id].points,10) : 0;
          o.alliance = o.alliance.length ? parseInt(o.alliance, 10) : 0;
          return o;
        });

        return resolve(players);
      })
      .then(function (players) {
        return resolve(players);
      }, function (err) {
        logger.error(err);
        return reject(err);
      });

  });
};

exports.getAlliances = function (server, callback) {

  return new Promise(function (resolve, reject) {

    getData(server, 'alliances')
      .then(function (results) {
        var alliances = results.data;

        alliances = _.map(alliances, function (o) {
          o.name = parseName(o.name);
          return o;
        });

        alliances = _.sortBy(alliances, function (o) { return parseInt(o.rank, 10); });

        return resolve(alliances);
      })
      .catch(reject);
  });
};

exports.getAllianceStats = function (server, stat, callback) {

  return new Promise(function(resolve, reject) {

    getData(server, stat)
      .then(function (results) {
        var alliances = {};

        _.each(results.data, function (o) {
          alliances[o.id] = o;
        });

        return resolve(alliances);
      })
      .catch(reject);
  });
};

exports.getAlliancesFull = function (server, callback) {

  return new Promise(function (resolve, reject) {

    Promise.join(
        exports.getAllianceStats(server, 'alliance_kills_att'),
        exports.getAllianceStats(server, 'alliance_kills_def'),
        exports.getAlliances(server),
        function (abp, dbp, alliances) {
          alliances = _.map(alliances, function (o) {
            o.abp = parseInt(abp[o.id].points,10);
            o.dbp = parseInt(dbp[o.id].points,10);
            return o;
          });

          return resolve(alliances);
        })
        .then(function (alliances) {
          return resolve(alliances);
        }, function (err) {
          logger.error(err);
          return reject(err);
        });

  });
};

exports.getTowns = function (server) {

  return new Promise(function (resolve, reject) {

    getData(server, 'towns')
      .then(function (results) {
        var towns = results.data;

        towns = _.map(towns, function (o) {
          o.name = parseName(o.name);
          o.player = (o.player && o.player.length) ? parseInt(o.player, 10) : 0;
          return o;
        });

        return resolve(towns);
      })
      .catch(reject);

  });
};

exports.getIslands = function (server, callback) {

  return new Promise(function (resolve, reject) {

    getData(server, 'islands')
      .then(function (results) {
        var islands = results.data;

        return resolve(islands);
      })
      .catch(reject);
  });
};

exports.getConquers = function (server, callback) {

  return new Promise(function (resolve, reject) {
  
    getData(server, 'conquers')
      .then(function (results) {
        var conquers = results.data;

        conquers = _.map(conquers, function (o) {
          o.newPlayer = (o.newPlayer && o.newPlayer.length) ? parseInt(o.newPlayer, 10) : 0;
          o.oldPlayer = (o.oldPlayer && o.oldPlayer.length) ? parseInt(o.oldPlayer, 10) : 0;
          o.newAlly = (o.newAlly && o.newAlly.length) ? parseInt(o.newAlly, 10) : 0;
          o.oldAlly = (o.oldAlly && o.oldAlly.length) ? parseInt(o.oldAlly, 10) : 0;

          return o;
        });

        return resolve(conquers);
      })
      .catch(reject);
  });
};