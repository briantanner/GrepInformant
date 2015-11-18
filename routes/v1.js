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

var Data = {};

Data.query = function (query, callback) {
  dbQuery({ text: query }, function (err, result) {
    if (err) { return callback(err); }
    return callback(null, result.rows);
  });
};

Data.alliances = function (options, callback) {
  var query = options.query || "select * from alliances";

  if (options.ids) {
    query += (_.isArray(options.ids)) ? 
      util.format(" where id in (%s)", options.ids.join(', ')) : 
      util.format(" where id = %s", "" + options.ids);
  }

  query += " order by rank asc";

  this.query(query, callback);
};

Data.conquers = function (options, callback) {
  var select = [ "c.time", "c.town", "t.name as townname", "t.points", "c.newplayer as newplayerid", 
                 "newplayer.name as newplayer", "c.oldplayer as oldplayerid", "oldplayer.name as oldplayer", 
                 "c.newally as newallyid", "newally.name as newally", "c.oldally as oldallyid", "oldally.name as oldally" ],
      joins = [ "left join players newplayer on newplayer.id = c.newplayer", 
                "left join players oldplayer on oldplayer.id = c.oldplayer",
                "left join alliances newally on newally.id = c.newally", 
                "left join alliances oldally on oldally.id = c.oldally",
                "join towns t on c.town = t.id" ],
      query = options.query || util.format("select %s from conquers c %s", select.join(", "), joins.join(" "));

  if (options.alliances) {
    query += (_.isArray(options.alliances)) ?
      util.format(" where newally = %s OR oldally = %s", "" + options.alliances) :
      util.format(" where newally in (%s) or oldally in (%s)", options.alliances.join(', '));
  }

  if (options.players) {
    query += (_.isArray(options.players)) ?
      util.format(" where newplayer = %s OR oldplayer = %s", "" + options.players) :
      util.format(" where newplayer in (%s) or oldplayer in (%s)", options.players.join(', '));
  }

  if (options.where)
    query += " where " + options.where;

  query += " order by time desc";

  this.query(query, function (err, result) {
    if (err) { return callback(err); }

    result = _.map(result, function (o) {
      o.time = new Date(o.time*1000).toUTCString();
      o.newplayer = (o.newplayer && o.newplayer.length) ? o.newplayer : 'Unknown';
      o.oldplayer = (o.oldplayer && o.oldplayer.length) ? o.oldplayer : 'Unknown';
      o.newally = (o.newallyid) ? (o.newally && o.newally.length) ? o.newally : 'Unknown' : 'No Alliance';
      o.oldally = (o.oldallyid) ? (o.oldally && o.oldally.length) ? o.oldally : 'Unknown' : 'No Alliance';

      return o;
    });

    return callback(null, result);
  });
};

Data.towns = function (options, callback) {
  var query = "select * from towns";

  if (playerId)
    query += util.format(" where player = %s", playerId);

  this.query({ text: query }, callback);
};

Data.islands = function (options, callback) {
  var query = "select * from islands";

  if (!options.where || (options.x && options.y))
    return callback('Missing required arguments.')

  dbQuery({ text: query }, callback);
};

Data.players = function (options, callback) {
  var query = "select * from players";

  if (options.where)
    query += " where " + options.where;

  if (options.ids) {
    query += (_.isArray(options.ids)) ? 
      util.format(" where id in (%s)", options.ids.join(', ')) : 
      util.format(" where id = %s", "" + options.ids);
  }

  query += " order by rank asc";

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

Data.searches = function (options, callback) {
  var query = "select * from searches";

  if (options.id)
    query += util.format(" where id = '%s'", options.id);

  this.query(query, callback);
};

exports.index = function (req, res) {
  // need a home page
  return res.send(200, "Hello! :)");
};

exports.towns = function (req, res) {
  var server = req.params.server,
      playerId = req.params.playerId || null;

  Data.towns({ player: playerId }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result.rows);
  });
};

exports.islands = function (req, res) {
  var x = req.params.x || null,
      y = req.params.y || null;

  Data.islands({}, function (err, result) {
    if (err) { return callback(err); }
    return callback(null, result);
  });
};

exports.alliances = function (req, res) {
  var server = req.params.server;

  Data.alliances(server, function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });
};

exports.players = function (req, res) {
  var server = req.params.server;

  Data.players({}, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result.rows);
  });
};

exports.player = function (req, res) {
  var server = req.params.server,
      whereString = util.format("id = %s", req,params.playerId);

  Data.players({ where: whereString }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result.rows);
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
      Data.alliances({}, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, { alliances: result.rows });
      });
    },

    // Get search options
    function (data, callback) {
      if (!id) { return callback(null, data); }
      
      Data.searches({ id: id }, function (err, result) {
        if (err) { return callback(err); }
        var row = result.rows.shift();
        data.options = JSON.parse(row.options);
        return callback(null, data);
      });
    },

    // update last_used
    function (data, callback) {
      if (!data.id) { return callback(null, data); }
      var time = Math.floor( new Date() / 1000),
          query = util.format("update searches set last_used = '%s' where id = '%s'", time, data.id);

      Data.query(query, function (err) {
        if (err) { return callback(err); }
        return callback(null, data);
      });
    },

    // get selected players' data
    function (data, callback) {
      if (!id) { return callback(null, data); }
      if (!data.options.player || data.options.player.length === 0) { return callback(null, data); }

      var whereString = util.format("id in (%s)", data.options.player.join(', '));

      Data.players({ where: whereString }, function (err, result) {
        if (err) { return callback(err); }
        var players = _.indexBy(result.rows, 'id');

        data.options.player = _.map(data.options.player, function (id) {
          return { id: id, name: players[id].name };
        });

        return callback(null, data);
      });
    },

    // get hashed searches
    function (data, callback) {
      if (!id) { return callback(null, data); }
      var ally = data.options.ally,
          player = _.pluck(data.options.player, 'id'),
          allyColor = data.options.allycolor,
          playerColor = data.options.playercolor;

      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          query = util.format("select %s from towns t %s", select.join(', '), joins.join(' '));

      if (ally.length) {
        query += " where p.alliance in (" + ally.join(", ") + ")";
      }
      if (player.length) {
        query += (ally.length) ? " or" : " where";
        query += " t.player in (" + player.join(", ") + ")";
      }

      Data.query(query, function (err, result) {
        if (err) { return callback(err); }
        data.towns = result.rows;
        
        if (allyColor.length || playerColor.length) {
          var allyColors = {},
              playerColors = {};
          
          _.each(allyColor, function (color, i) { allyColors[ally[i]] = color; });
          _.each(playerColor, function (color, i) { playerColors[player[i]] = color; });

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

      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          query = util.format("select %s from towns t %s", select.join(', '), joins.join(' '));
      
      if (playerId) query += util.format(" where t.player = '%s'", playerId);
      if (allyId) query += util.format(" where p.alliance = %s", allyId);
      
      Data.query(query, function (err, result) {
        if (err) { return callback(err); }
        data.towns = result.rows;
        return callback(null, data);
      });
    },

    // get ghosts
    function (data, callback) {
      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          where = "t.player = 0 and t.points > 1200",
          query = util.format("select %s from towns t %s where %s", select.join(', '), joins.join(' '), where);

      Data.query(query, function (err, result) {
        if (err) { return callback(err); }
        data.towns = (data.towns && data.towns.length) ? data.towns.concat(result.rows) : result.rows;
        return callback(null, data);
      });
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    data.towns = _.map(data.towns, function (o) {
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

exports.mapCanvas = function (req, res) {
  var server = req.params.server,
      id = req.params.id || req.query.id || req.query.q || null;

  async.waterfall([

    // get alliances
    function (callback) {
      Data.alliances({}, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, { alliances: result });
      });
    },

    function (data, callback) {
      if (!id) { return callback(null, data); }
      var query = util.format("select * from searches where id = '%s'", id);

      Data.searches({ id: id }, function (err, result) {
        if (err) { return callback(err); }
        
        if (!result || !result.length) return callback(null, data);

        var row = result[0];
        data.options = JSON.parse(row.options);
        
        return callback(null, data);
      });
    },

    function (data, callback) {
      if (!id) return callback(null, data);
      if (!data.options) return callback(null, data);
      if (!data.options.player || data.options.player.length === 0)
        return callback(null, data);

      var query = util.format("select id, name from players where id in (%s)", data.options.player.join(', '));

      dbQuery({ text: query }, function (err, result) {
        if (err) { return callback(err); }
        var players = _.indexBy(result.rows, 'id');
        
        data.options.player = _.map(data.options.player, function (id) {
          return {
            id: id,
            name: players[id].name
          };
        });

        return callback(null, data);
      });
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    
    data.id = id;
    data.server = server;

    if (!data.options) {
      data.id = null;
      data.error = 'Your map has expired.';
    }

    return res.render('mapCanvas', data);
  });
};

exports.offsets = function (req, res) {
  var query = "select * from offsets";

  dbQuery({ text: query }, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.allianceConquers = function (req, res) {

  var server = req.params.server,
      alliance = req.params.alliance,
      start = req.query.start || null,
      end = req.query.end || null,
      hideInternals = req.query.hideinternals || null;

  async.waterfall([

    function (callback) {
      var whereString = util.format("newally = %s", alliance),
          startArray = (start) ? start.split('-') : null,
          endArray   = (end)   ? end.split('-') : null,
          startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
          endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null;

      if (hideInternals)
        whereString += util.format(" and oldally != %s", alliance);

      if (startDate)
        whereString += util.format(" and time > %s", startDate);
      if (endDate)
        whereString += util.format(" and time < %s", endDate);

      Data.conquers({ where: whereString }, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, { conquers: result });
      });
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }

    data.title = "Alliance Conquers";
    data.ally = _.sample(data.conquers).newally;

    return res.render('allyconquers', _.extend(defaults, data));
  });
};

exports.allianceLosses = function (req, res) {
  var server = req.params.server,
      alliance = req.params.alliance,
      start = req.query.start || null,
      end = req.query.end || null;

  async.waterfall([

    function (callback) {
      var whereString = util.format("oldally = %s and newally != %s and newally is not null", alliance, alliance),
          startArray = (start) ? start.split('-') : null,
          endArray   = (end)   ? end.split('-') : null,
          startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
          endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null;

      if (startDate)
        whereString += util.format(" and time > %s", startDate);
      if (endDate)
        whereString += util.format(" and time < %s", endDate);

      Data.conquers({ where: whereString }, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, { losses: result });
      });
    },

    function (data, callback) {
      data.title = "Alliance Losses";
      data.ally = _.sample(data.losses).oldally;
      data.totalLosses = data.losses.length;
      data.lossCount = _.countBy(data.losses, function (o) { return o.newally; });
      data.lossCount = _.map(data.lossCount, function (k,o) { return { ally: o, count: k }; });
      data.lossCount = _.sortBy(data.lossCount, 'count').reverse();

      return callback(null, data);
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    // return res.send(200, data);
    return res.render('allylosses', _.extend(defaults, data));
  });
};

exports.compare = function (req, res) {
  var server = req.params.server,
      comparedAlliances = config.comparealliances;

  if (req.query.ally) {
    var allies = req.query.ally,
        comparedAlliances = [];
    _.each(req.query.ally, function (ids) {
      ids = ids.split(',');
      ids = _.map(ids, function (id) { return parseInt(id, 10); });
      comparedAlliances.push(ids);
    });
  }

  async.waterfall([

    function (callback) {
      Data.alliances({ ids: _.flatten(comparedAlliances) }, function (err, data) {
        if (err) { return callback(err); }
        var compareData = [];

        comparedAlliances.forEach(function(row) {
          var tmp = _.filter(data, function(o) { return row.indexOf(o.id) !== -1; });
          compareData.push(tmp);
        });

        delete data;

        return callback(null, compareData);
      });
    },

    function (compareData, callback) {
      var totals = [],
          data = {};

      _.each(compareData, function (row) {
        var points = _.reduce(row, function(num,o){ return num + o.points; }, 0),
            towns = _.reduce(row, function(num,o){ return num + o.towns; }, 0),
            members = _.reduce(row, function(num,o){ return num + o.members; }, 0),
            names = _.reduce(row, function(arr,o){ return arr.concat([o.name]); }, []),
            nameStr = names.join(' / ');

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

        totals.push(total);
      });

      totals = _.sortBy(totals, function (o) { return parseInt(o.pointsInt,10); }).reverse();
      return callback(null, totals);
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    return res.render('compare', _.extend(defaults, { alliances: data }));
  });
};

exports.bgConquers = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(config.alliance, 10),
      enemy = parseInt(config.enemy, 10),
      start = req.query.start || null,
      end = req.query.end || null,
      battleGroups = config.battlegroups,
      battleGroupIds = config.battlegroupids;

  async.waterfall([

    function (callback) {
      Data.alliances({ ids: [alliance, enemy] }, callback);
    },

    function (data, callback) {
      data = { alliances: data };

      var whereString = util.format("newally = %d and oldally = %d", alliance, enemy),
          startArray = (start) ? start.split('-') : null,
          endArray   = (end)   ? end.split('-') : null,
          startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
          endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null;

      if (startDate)
        whereString += util.format(" and time > %s", startDate);
      if (endDate)
        whereString += util.format(" and time < %s", endDate);

      Data.conquers({ where: whereString }, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, _.extend(data, { conquers: result }));
      });
    },

    function (data, callback) {

      var conquers = {};
          bgConquers = {},
          totalConquers = 0;

      _.each(battleGroupIds, function (group, index) {
        index++;

        var _conquers = _.reject(data.conquers, function (o) { return _.indexOf(group, ""+o.newplayerid) === -1; });
        
        if (!conquers[index]) { conquers[index] = _conquers; }
        
        conquers[index].concat(_conquers);
        bgConquers[index] = conquers[index].length;
        totalConquers += conquers[index].length;
      });

      data.conquers = conquers;
      data.bgConquers = bgConquers;
      data.totalConquers = totalConquers;

      return callback(null, data);
    },

    function (data, callback) {

      _.map(data.conquers, function (battleGroup, i) {
        battleGroup.total = bgConquers[i];
        battleGroup.players = config.battlegroups[--i].join(', ');

        return battleGroup;
      });

      return callback(null, data);
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }

    data.title = "Battle Group Conquers";
    data.ally = _.findWhere(data.alliances, { id: alliance }).name;
    data.enemy = _.findWhere(data.alliances, { id: enemy }).name;

    delete data.alliances;

    return res.render('bgconquers', _.extend(defaults, data));
  });
};


/* Begin API Routes */

exports.autocomplete = function (req, res) {
  var server = req.params.server,
      table = req.params.table || 'players',
      input = req.query.input.replace(/'/g, "''") || null;

  if (!input || input.length < 3) { return res.send(500, 'Input string must be at least 3 characters.'); }

  var query = util.format("select * from %s where lower(name) like lower('%s%%') order by name asc limit 10", table, input);
  Data.query(query, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, result);
  });
};

exports.search = function (req, res) {
  var server = req.params.server,
      ally = req.body.ally,
      player = req.body.player;
    
  if (!ally.length && !player.length) { return res.send(500, 'Nothing to search'); }

  var query = "insert into searches (id, time, options) values ('%s', %d, '%s')",
      sha256 = crypto.createHash("sha1", "utf8"),
      time = Math.floor( new Date() / 1000),
      id = "",
      hashKey = time + ally.concat(player).join(",");

  sha256.update(hashKey);
  id = sha256.digest('hex');

  query = util.format(query, id, time, JSON.stringify(req.body).replace(/'/g, "''"));

  Data.query(query, function (err, result) {
    if (err) { return res.send(500, err); }
    return res.send(200, { id: id });
  });
};

exports.getMap = function (req, res) {
  var server = req.params.server,
      id = req.query.id || null;

  async.waterfall([

    // get alliances
    function (callback) {
      Data.alliances({}, function (err, result) {
        if (err) { return callback(err); }
        return callback(null, { alliances: result.rows });
      });
    },

    // get search data
    function (data, callback) {
      if (!id) { return callback(null, data); }

      Data.searches({ id: id }, function (err, result) {
        if (err) { return callback(err); }
        var row = result.shift();
        row.options = JSON.parse(row.options);
        return callback(null, row);
      });
    },

    // update last_used
    function (data, callback) {
      if (!data.id) { return callback(null, data); }
      
      var time = Math.floor( new Date() / 1000),
          query = util.format("update searches set last_used = '%s' where id = '%s'", time, data.id);

      Data.query(query, function (err) {
        if (err) { return callback(err); }
        return callback(null, data);
      });
    },

    // map id/name to search options
    function (data, callback) {
      if (!id) { return callback(null, data); }
      if (!data.options.player || data.options.player.length === 0) { return callback(null, data); }

      var whereString = util.format("id in (%s)", data.options.player.join(', '));

      Data.players({ where: whereString }, function (err, result) {
        if (err) { return callback(err); }
        var players = _.indexBy(result.rows, 'id');

        data.options.player = _.map(data.options.player, function (id) {
          return { id: id, name: players[id].name };
        });

        return callback(null, data);
      });
    },

    // get towns from search params
    function (data, callback) {
      if (!id) { return callback(null, data); }
      var ally = data.options.ally,
          player = _.pluck(data.options.player, 'id'),
          allyColor = data.options.allycolor,
          playerColor = data.options.playercolor;

      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          query = util.format("select %s from towns t %s", select.join(', '), joins.join(' '));

      if (ally.length) {
        query += " where p.alliance in (" + ally.join(", ") + ")";
      }
      if (player.length) {
        query += (ally.length) ? " or" : " where";
        query += " t.player in (" + player.join(", ") + ")";
      }

      Data.query(query, function (err, result) {
        if (err) { return callback(err); }
        data.towns = result;
        
        if (allyColor.length || playerColor.length) {
          var allyColors = {},
              playerColors = {};
          
          _.each(allyColor, function (color, i) { allyColors[ally[i]] = color; });
          _.each(playerColor, function (color, i) { playerColors[player[i]] = color; });

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

    // get ghosts
    function (data, callback) {
      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          where = "t.player = 0 and t.points > 1200",
          query = util.format("select %s from towns t %s where %s", select.join(', '), joins.join(' '), where);

      Data.query(query, function (err, result) {
        if (err) { return callback(err); }
        data.towns = (data.towns && data.towns.length) ? data.towns.concat(result) : result;
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

    return res.send(200, data);
  });
};