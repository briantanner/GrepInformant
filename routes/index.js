
/*
 * GET home page.
 */

var _ = require('underscore'),
  util = require('util'),
  urlencode = require('urlencode'),
  async = require('async'),
  accounting = require('accounting'),
  grepolis = require('../lib/grepolis');
  config = require('../config.json'),
  defaults = { title: 'Grepolis Tools' };

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

exports.islands = function (req, res) {
  var server = req.params.server;

  grepolis.getIslands(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });
};

exports.players = function (req, res) {
  var server = req.params.server;

  grepolis.getPlayersFull(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.playerStats = function (req, res) {
  var server = req.params.server,
      stat = util.format('player_kills_%s', req.params.stat);

  grepolis.getPlayerStats(server, stat, function (err, data) {
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

  grepolis.getPlayersFull(server, function (err, data) {
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

        o.town = parseName(town.name);
        o.points = parseInt(town.points,10);
        o.time = new Date(o.time*1000).toUTCString();
        o.newPlayer = (o.newPlayer.length && data.players[o.newPlayer]) ?
          parseName(data.players[o.newPlayer].name) : 'Unknown';
        o.oldPlayer = (o.oldPlayer.length && data.players[o.oldPlayer]) ?
          parseName(data.players[o.oldPlayer].name) : 'Unknown';
        if (o.newAlly.length) {
          o.newAlly = (data.alliances[o.newAlly]) ?
            parseName(data.alliances[o.newAlly].name) : 'Unknown';
        } else {
          o.newAlly = 'No Alliance';
        }
        if (o.oldAlly.length) {
          o.oldAlly = (data.alliances[o.oldAlly]) ?
            parseName(data.alliances[o.oldAlly].name) : 'Unknown';
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
      data.ally = parseName(data.alliances[alliance].name);
      
      delete data.towns;
      delete data.players;
      delete data.alliances;

      return res.render('allyconquers', _.extend(defaults, data));
    });

};

exports.allianceLosses = function (req, res) {
  var server = req.params.server,
      alliance = req.params.alliance,
      start = req.query.start,
      end = req.query.end || null,
      enemies = req.query.enemies.split(',');

  async.waterfall([

    function (callback) {
      getDefaultData(server, callback);
    },

    function (data, callback) {
      grepolis.getConquers(server, function (err, _data) {
        if (err) { return callback(err); }
        var losses = {},
            startArray = start.split('-'),
            endArray = (end) ? end.split('-') : null;

        var startDate = new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000;
        if (end) {
          var endDate = new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000;
        }
        console.log(end, endDate);

        _data = _.filter(_data, function (o) { return _.indexOf(enemies, o.newAlly) !== -1 && parseInt(o.oldAlly,10) == alliance; });
        _data = _.filter(_data, function (o) { return parseInt(o.time) >= startDate; }.bind(startDate));

        if (endDate) {
          _data = _.filter(_data, function (o) { return parseInt(o.time) <= endDate; }.bind(endDate));
        }

        _data = _.sortBy(_data, function (o) { return parseInt(o.time,10); }).reverse();

        data.conquers = _data;
        return callback(null, data);
      });
    },

    function (data, callback) {
      _.map(data.conquers, function (o) {
        var town = data.towns[o.town];

        o.town = parseName(town.name);
        o.points = parseInt(town.points,10);
        o.time = new Date(o.time*1000).toUTCString();
        o.newPlayer = (o.newPlayer.length && data.players[o.newPlayer]) ?
          parseName(data.players[o.newPlayer].name) : 'Unknown';
        o.oldPlayer = (o.oldPlayer.length && data.players[o.oldPlayer]) ?
          parseName(data.players[o.oldPlayer].name) : 'Unknown';
        o.newAllyId = parseInt(o.newAlly,10);
        if (o.newAlly.length) {
          o.newAlly = (data.alliances[o.newAlly]) ?
            parseName(data.alliances[o.newAlly].name) : 'Unknown';
        } else {
          o.newAlly = 'No Alliance';
        }
        if (o.oldAlly.length) {
          o.oldAlly = (data.alliances[o.oldAlly]) ?
            parseName(data.alliances[o.oldAlly].name) : 'Unknown';
        } else {
          o.oldAlly = 'No Alliance';
        }

        return o;
      });

      return callback(null, data);
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }

    data.title = "Alliance Losses";
    data.ally = parseName(data.alliances[alliance].name);
    data.totalLosses = data.conquers.length;
    data.lossCount = [];

    _.each(enemies, function (id) {
      id = parseInt(id,10);
      
      data.lossCount.push({
        'ally': parseName(data.alliances[id].name),
        'count': _.countBy(data.conquers, function (o) { return o.newAllyId === id; }).true || 0
      });

      data.lossCount = _.sortBy(data.lossCount, function (o) { return o.count; }).reverse();

    });
    
    delete data.towns;
    delete data.players;
    delete data.alliances;

    return res.render('allylosses', _.extend(defaults, data));
  });
};

exports.sharedIslands = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(req.params.alliance,10),
      enemy = parseInt(req.params.enemy,10),
      ocean = req.params.ocean ? parseInt(req.params.ocean,10) : null,
      getLts = req.query.lts || null;

  async.waterfall([

    function (callback) {
      grepolis.getAllianceTowns(server, alliance, ocean, function (err, towns) {
        if (err) { return callback(err); }
        return callback(null, { alliance: towns });
      });
    },

    function (data, callback) {
      grepolis.getAllianceTowns(server, enemy, ocean, function (err, towns) {
        if (err) { return callback(err); }
        return callback(null, _.extend(data, { enemy: towns }));
      });
    },

    function (data, callback) {
      var allianceObj = { keys: _.uniq(_.pluck(data.alliance, 'islandXy')), islands: {} },
          enemyObj = { keys: _.uniq(_.pluck(data.enemy, 'islandXy')), islands: {} },
          islands = {};

      _.each(data.alliance, function (o) {
        if (!allianceObj.islands[o.islandXy]) {
          allianceObj.islands[o.islandXy] = [];
        }

        allianceObj.islands[o.islandXy].push(o);
      });

      _.each(data.enemy, function (o) {
        if (!enemyObj.islands[o.islandXy]) {
          enemyObj.islands[o.islandXy] = [];
        }

        enemyObj.islands[o.islandXy].push(o);
      });

      // return callback(null, {alliance: allianceObj, enemy: enemyObj});
      
      var intersection = _.intersection(allianceObj.keys, enemyObj.keys);
      allianceObj.islands = _.reject(allianceObj.islands, function (o) { return _.indexOf(intersection, o.islandXy) !== -1; });
      enemyObj.islands = _.reject(enemyObj.islands, function (o) { return _.indexOf(intersection, o.islandXy) !== -1; });

      delete allianceObj.keys;
      delete enemyObj.keys;

      var enemyIslands = {},
          sharedIslands = {};

      _.each(enemyObj.islands, function (o) {
        var islandId = o[0].islandId;
        enemyIslands[islandId] = o;
      });

      _.each(allianceObj.islands, function (o) {
        var islandId = o[0].islandId;
        
        if (!enemyIslands[islandId]) { return; }
        if (getLts) {
          if (enemyIslands[islandId].length > 3 || o.length < 3) { return; }
        }
        
        sharedIslands[islandId] = {
          allyCount: o.length,
          enemyCount: enemyIslands[islandId].length,
          towns: o,
          enemies: enemyIslands[islandId]
        };

      });

      return callback(null, sharedIslands);
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

};

exports.bgConquers = function (req, res) {

  var server = req.params.server,
      alliance = parseInt(config.alliance,10),
      enemy = parseInt(config.enemy,10),
      battleGroups = config.battlegroups,
      battleGroupIds = config.battlegroupids;

  async.waterfall([

    function (callback) {
      getDefaultData(server, callback);
    },

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
          o.town = parseName(town.name);
          o.points = parseInt(town.points,10);
          o.time = new Date(o.time*1000).toUTCString();
          o.newPlayer = (o.newPlayer.length && data.players[o.newPlayer]) ?
            parseName(data.players[o.newPlayer].name) : 'Unknown';
          o.oldPlayer = (o.oldPlayer.length && data.players[o.oldPlayer]) ?
            parseName(data.players[o.oldPlayer].name) : 'Unknown';
          o.newAlly = parseName(data.alliances[o.newAlly].name);
          o.oldAlly = parseName(data.alliances[o.oldAlly].name);
          return o;
        });

        return battleGroup;
      });

      return callback(null, data);
    }

    ], function (err, data) {
      if (err) { return res.send(500, err); }

      data.title = "Battle Group Conquers";
      data.ally = parseName(data.alliances[alliance].name);
      data.enemy = parseName(data.alliances[enemy].name);
      
      delete data.towns;
      delete data.players;
      delete data.alliances;

      return res.render('bgconquers', _.extend(defaults, data));
    });

};

exports.compare = function (req, res) {
  var server = req.params.server,
      compared_alliances = [
        [4],
        [293, 256, 492],
        [301],
        [1547],
        [47, 2185],
        [66, 97, 1951, 1502, 3307]
      ];

  grepolis.getData(server, 'alliances', function (err, data) {
    if (err) { return; }
    var alliances = _.sortBy(data, function(o){ return parseInt(o.rank, 10); }).slice(0,30),
        compare_data = [],
        conquer_data = [],
        total_data = [],
        payload = {};

    compared_alliances.forEach(function(row) {
      var tmp = _.filter(alliances, function(o) { return row.indexOf(parseInt(o.id,10)) !== -1; });
      compare_data.push(tmp);
    });

    _.map(compare_data, function (row) {
      _.map(row, function(o){ o.name = parseName(o.name); return o; });

      var points = _.reduce(row, function(num,o){ return num + parseInt(o.points,10); }, 0),
          towns = _.reduce(row, function(num,o){ return num + parseInt(o.towns,10); }, 0),
          members = _.reduce(row, function(num,o){ return num + parseInt(o.members,10); }, 0),
          names = _.reduce(row, function(arr,o){ return arr.concat([o.name]); }, []),
          nameStr = names.join('/');

      var total = {
        name: nameStr,
        points: points,
        pointsInt: points,
        towns: towns,
        members: members,
        average: {
          points: accounting.formatNumber(points/members),
          towns: accounting.formatNumber(towns/members),
          town_size: accounting.formatNumber(points/towns)
        }
      };

      row.push(total);
      total_data.push(total);

      _.map(row, function(o) {
        o.points = accounting.formatNumber(o.points);
        o.towns = accounting.formatNumber(o.towns);
        return o;
      });

      _.map(total_data, function(o) {
        o.points = accounting.formatNumber(o.points);
        o.towns = accounting.formatNumber(o.towns);
        return o;
      });

      return row;
    });

    grepolis.getData(server, 'conquers', function (err, data) {
      if (err) { return; }

      var tmp = _.filter(data, function(o) { return compared_alliances[0].indexOf(parseInt(o.newAlly,10)) !== -1; });
      tmp = _.filter(tmp, function(o) { return compared_alliances[1].indexOf(parseInt(o.oldAlly,10)) !== -1; });

      total_data[0].conquers = tmp.length;
      // conquer_data.push(tmp.length);

      var tmp = _.filter(data, function(o) { return compared_alliances[1].indexOf(parseInt(o.newAlly,10)) !== -1; });
      tmp = _.filter(tmp, function(o) { return compared_alliances[0].indexOf(parseInt(o.oldAlly,10)) !== -1; });

      total_data[1].conquers = tmp.length;
      // conquer_data.push(tmp.length);

      total_data = _.sortBy(total_data, function (o) { return parseInt(o.pointsInt,10); }).reverse();

      var payload = _.extend(defaults, {alliances: total_data});

      res.render('index', payload);

      payload = null;
      data = null;
      tmp = null;
    });
    data = null;
  });
};