
/*
 * GET home page.
 */

var _ = require('underscore'),
  async = require('async'),
  accounting = require('accounting'),
  utils = require('Grepolis-Utils'),
  config = require('../config.json'),
  defaults = { title: 'Grepolis Tools' };

function loadTowns(server, callback) {
  utils.getData(server, 'towns', function (err, data) {
    if (err) { return callback(err); }
    var towns = {};

    _.each(data, function (o) {
      towns[o.id] = o;
    });

    return callback(null, towns);
  });
}

function loadPlayers(server, callback) {
  utils.getData(server, 'players', function (err, data) {
    if (err) { return callback(err); }
    var players = {};

    data = _.sortBy(data, function (o) { return parseInt(o.rank, 10); });

    _.each(data, function (o) {
      players[o.id] = o;
    });
    
    return callback(null, players);
  });
}

function loadAlliances(server, callback) {
  utils.getData(server, 'alliances', function (err, data) {
    if (err) { return callback(err); }
    var alliances = {};

    data = _.sortBy(data, function (o) { return parseInt(o.rank, 10); });

    _.each(data, function (o) {
      alliances[o.id] = o;
    });

    return callback(null, alliances);
  });
}

exports.index = function(req, res) {
  return res.send(200, 'Hello!');
  // res.render('index', defaults);
};

exports.towns = function (req, res) {
  var server = req.params.server;

  utils.getData(server, 'towns', function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.players = function (req, res) {
  var server = req.params.server;

  utils.getData(server, 'players', function (err, data) {
    if (err) { return res.send(500, err); }
    data = _.sortBy(data, function (o) { return parseInt(o.rank, 10); });
    return res.send(200, data);
  });

};

exports.alliances = function (req, res) {
  var server = req.params.server;

  utils.getData(server, 'alliances', function (err, data) {
    if (err) { return res.send(500, err); }
    data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
    return res.send(200, data);
  });

};

exports.conquers = function (req, res) {
  var server = req.params.server;

  utils.getData(server, 'conquers', function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.alliancePlayers = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(req.params.alliance || config.alliance,10);

  utils.getData(server, 'players', function (err, data) {
    if (err) { return res.send(500, err); }
    data = _.filter(data, function (o) { return parseInt(o.alliance,10) == alliance; });
    data = _.sortBy(data, function (o) { return parseInt(o.rank); });
    return res.send(200, data);
  });

};

exports.battleGroupIds = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(config.alliance,10),
      battleGroups = config.battlegroups,
      battleGroupIds = [];

  utils.getData(server, 'players', function (err, data) {
    if (err) { return res.send(500, err); }
    
    data = _.filter(data, function (o) { return parseInt(o.alliance, 10) == alliance; });
    
    _.each(battleGroups, function (group) {
    
      group = _.map(group, function (name) {
        name = name.replace(/\s/g, '+');
        var o = _.findWhere(data, {name: name});
        if (!o) { return; }
        return o.id;
      });
    
      battleGroupIds.push(group);

    });
  
    return res.send(200, battleGroupIds);

  });
};

exports.bgConquers = function (req, res) {

  var server = req.params.server,
      alliance = parseInt(config.alliance,10),
      enemy = parseInt(config.enemy,10),
      battleGroups = config.battlegroups,
      battleGroupIds = config.battlegroupids,
      bgConquers = {},
      totalConquers = {};

  async.waterfall([

    function (callback) {
      loadPlayers(server, function (err, players) {
        if (err) { return callback(err); }
        var data = {};
        data.players = players;
        return callback(null, data);
      });
    },

    function (data, callback) {
      loadAlliances(server, function (err, alliances) {
        if (err) { return callback(err); }
        data.alliances = alliances;
        return callback(null, data);
      });
    },

    function (data, callback) {
      loadTowns(server, function (err, towns) {
        if (err) { return callback(err); }
        data.towns = towns;
        return callback(null, data);
      });
    },

    function (data, callback) {
      utils.getData(server, 'conquers', function (err, _data) {
        if (err) { return callback(err); }
        _data = _.filter(_data, function (o) { return parseInt(o.newAlly,10) == alliance && parseInt(o.oldAlly,10) == enemy; });
        _data = _.sortBy(_data, function (o) { return parseInt(o.time,10); }).reverse();
        
        _.each(battleGroupIds, function (group, index) {
          index++;
          var conquers = _.reject(_data, function (o) { return _.indexOf(group, o.newPlayer) === -1; });
          if (!bgConquers[index]) { bgConquers[index] = conquers; }
          bgConquers[index].concat(conquers);
          totalConquers[index] = bgConquers[index].length;
        });

        data.totalConquers = totalConquers;
        data.conquers = bgConquers;

        return callback(null, data);
      }.bind(data));
    },

    function  (data, callback) {
      _.map(data.conquers, function (conquers) {
        conquers = _.map(conquers, function (o) {
          var town = data.towns[o.town];
          o.town = town.name.replace(/\+/g, ' ');
          o.points = parseInt(town.points,10);
          o.time = new Date(o.time*1000).toUTCString();
          o.newPlayer = data.players[o.newPlayer].name.replace(/\+/g, ' ');
          o.oldPlayer = data.players[o.oldPlayer].name.replace(/\+/g, ' ');
          o.newAlly = data.alliances[o.newAlly].name.replace(/\+/g, ' ');
          o.oldAlly = data.alliances[o.oldAlly].name.replace(/\+/g, ' ');
          return o;
        });
        return conquers;
      });
      return callback(null, data);
    }

    ], function (err, data) {
      if (err) { return res.send(500, err); }

      data.title = "Battle Group Conquers";
      
      delete data.towns;
      delete data.players;
      delete data.alliances;

      return res.render('bgconquers', _.extend(defaults, data));
    });

};