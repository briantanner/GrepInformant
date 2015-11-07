
/*
 * GET home page.
 */

var _ = require('underscore'),
  async = require('async'),
  accounting = require('accounting'),
  grepolis = require('../lib/grepolis');
  config = require('../config.json'),
  defaults = { title: 'Grepolis Tools' };

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

exports.index = function(req, res) {
  return res.send(200, 'Hello!');
  // res.render('index', defaults);
};

exports.towns = function (req, res) {
  var server = req.params.server;

  grepolis.getTowns(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.players = function (req, res) {
  var server = req.params.server;

  grepolis.getPlayers(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.alliances = function (req, res) {
  var server = req.params.server;

  grepolis.getAlliances(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.conquers = function (req, res) {
  var server = req.params.server;

  grepolis.getConquers(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.alliancePlayers = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(req.params.alliance || config.alliance,10);

  grepolis.getPlayers(server, function (err, data) {
    if (err) { return res.send(500, err); }
    data = _.filter(data, function (o) { return parseInt(o.alliance,10) == alliance; });
    return res.send(200, data);
  });

};

exports.battleGroupIds = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(config.alliance,10),
      battleGroups = config.battlegroups,
      battleGroupIds = [];

  grepolis.getPlayers(server, function (err, data) {
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

exports.allianceConquers = function (req, res) {

  var server = req.params.server,
      alliance = parseInt(req.params.alliance || config.alliance, 10);

  async.waterfall([

    function (callback) {
      getDefaultData(server, callback);
    },

    function (data, callback) {
      
      grepolis.getConquers(server, function (err, _data) {
        if (err) { return callback(err); }

        _data = _.filter(_data, function (o) { return parseInt(o.newAlly, 10) == alliance || parseInt(o.oldAlly, 10) == alliance; });
        _data = _.sortBy(_data, function (o) { return parseInt(o.time, 10); }).reverse();

        data.conquers = _data;
        return callback(null, data);
      });

    },

    function (data, callback) {

      _.map(data.conquers, function (o) {
        var town = data.towns[o.town];

        o.town = town.name.replace(/\+/g, ' ').replace(/%27/g, "'");
        o.points = parseInt(town.points,10);
        o.time = new Date(o.time*1000).toUTCString();
        o.newPlayer = (o.newPlayer.length && data.players[o.newPlayer]) ?
          data.players[o.newPlayer].name.replace(/\+/g, ' ') : 'Unknown';
        o.oldPlayer = (o.oldPlayer.length && data.players[o.oldPlayer]) ?
          data.players[o.oldPlayer].name.replace(/\+/g, ' ') : 'Unknown';
        if (o.newAlly.length) {
          o.newAlly = (data.alliances[o.newAlly]) ?
            data.alliances[o.newAlly].name.replace(/\+/g, ' ') : 'Unknown';
        } else {
          o.newAlly = 'No Alliance';
        }
        if (o.oldAlly.length) {
          o.oldAlly = (data.alliances[o.oldAlly]) ?
            data.alliances[o.oldAlly].name.replace(/\+/g, ' ') : 'Unknown';
        } else {
          o.oldAlly = 'No Alliance';
        }

        return o;
      });

      return callback(null, data);
    }

    ], function (err, data) {
      if (err) { return res.send(500, err); }

      data.title = "Alliance Conquers";
      data.ally = data.alliances[alliance].name.replace(/\+/g, ' ');
      
      delete data.towns;
      delete data.players;
      delete data.alliances;

      return res.render('allyconquers', _.extend(defaults, data));
    })

};

exports.bgConquers = function (req, res) {

  var server = req.params.server,
      alliance = parseInt(config.alliance,10),
      enemy = parseInt(config.enemy,10),
      battleGroups = config.battlegroups,
      battleGroupIds = config.battlegroupids;

  async.waterfall([

    getDefaultData,

    function (data, callback) {
      grepolis.getConquers(server, function (err, _data) {
        if (err) { return callback(err); }

        var conquers = {};
            bgConquers = {},
            totalConquers = 0;

        var startDate = new Date(2015, 9, 10).getTime() / 1000;

        _data = _.filter(_data, function (o) { return parseInt(o.newAlly,10) == alliance && parseInt(o.oldAlly,10) == enemy; });
        _data = _.filter(_data, function (o) { return parseInt(o.time) > startDate; }.bind(startDate));
        _data = _.sortBy(_data, function (o) { return parseInt(o.time,10); }).reverse();
        _.each(battleGroupIds, function (group, index) {
          index++;
          
          var _conquers = _.reject(_data, function (o) { return _.indexOf(group, o.newPlayer) === -1; });
          
          if (!conquers[index]) { conquers[index] = _conquers; }
          
          conquers[index].concat(_conquers);
          bgConquers[index] = conquers[index].length;
          totalConquers += conquers[index].length;
        });

        data.conquers = conquers;
        data.bgConquers = bgConquers;
        data.totalConquers = totalConquers;

        return callback(null, data);
      }.bind(data));
    },

    function  (data, callback) {
      _.map(data.conquers, function (battleGroup, i) {
        battleGroup.total = bgConquers[i];
        battleGroup.players = config.battlegroups[--i].join(', ');
        battleGroup = _.map(battleGroup, function (o) {
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

        return battleGroup;
      });

      return callback(null, data);
    }

    ], function (err, data) {
      if (err) { return res.send(500, err); }

      data.title = "Battle Group Conquers";
      data.ally = data.alliances[alliance].name.replace(/\+/g, ' ');
      data.enemy = data.alliances[enemy].name.replace(/\+/g, ' ');
      
      delete data.towns;
      delete data.players;
      delete data.alliances;

      return res.render('bgconquers', _.extend(defaults, data));
    });

};