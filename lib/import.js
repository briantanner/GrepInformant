'use strict';

const _ = require('underscore');
const fs = require('fs');
const pg = require('pg').native;
const util = require('util');
const async = require('async');

let grepolis = require('./grepolis'),
    logger;

require('dotenv').load();

var dbString = process.env.HEROKU_POSTGRESQL_CHARCOAL_URL;
// var dbString = process.env.HEROKU_POSTGRESQL_BRONZE_URL;

function dbInsert (config, callback) {
  var table = config.table,
      keys = config.keys,
      data = config.data,
      lastQuery;

  pg.connect(dbString, function (err, client, done) {

    var handleError = function (err, callback) {
      if (!err) {
        return false;
      }

      if (client) {
        done(client);
      }

      logger.error(err);
      return callback(err);
    };

    if (handleError(err, callback)) {
      return;
    }

    var values = _.chain(data)
      .groupBy(function (el, i) {
        return Math.floor(i/100);
      })
      .toArray()
      .map(function (list) {
        list = _.map(list, function (o) {

          if (o.server && o.server.charAt(0) !== "'") o.server = "'" + o.server + "'";
          
          if (o.name && o.name.indexOf("'") !== -1) {
            o.name = o.name.replace(/'/g, "''");
            o.name = "'" + o.name + "'";
          }

          if (o.name && o.name.charAt(0) !== "'") {
            o.name = "'" + o.name + "'";
          }

          if (o.plus && o.plus.charAt(0) !== "'") {
            o.plus = "'" + o.plus + "'";
            o.minus = "'" + o.minus + "'";
          }

          return util.format('(%s)', _.values(o).join(', '));
        });

        return list.join(', ');
      })
      .value();

    async.eachSeries(values, function (list, cb) {

      var query = util.format("INSERT INTO %s (%s) VALUES %s", table, keys.join(', '), list);
      lastQuery = query;

      client.query({ text: query }, function (err, result) {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    }, function (err, result) {
      if (err) {
        logger.error("Failed query: %s", lastQuery);
        return callback(err);
      }
      
      done();
      pg.end();
      
      return callback(null, result);
    });

  });
}

function dbUpsert (config, callback) {
  var table = config.table,
      primary = config.primary || 'id',
      keys = config.keys,
      data = config.data,
      server = config.server;

  pg.connect(dbString, function (err, client, done) {

    var handleError = function (err, callback) {
      if (!err) {
        return;
      }

      if (client) {
        done(client);
      }

      logger.error(err);
      return callback(err);
    };

    if (handleError(err, callback)) {
      return;
    }

    var values = _.chain(data)
      .groupBy(function (el, i) { // split values into groups of 100
        return Math.floor(i/100);
      })
      .toArray() // convert to array
      .map(function (list) { // map value arrays to insert strings
        list = _.map(list, function (o) {
          
          if (o.server) o.server = "'" + o.server + "'";
          
          if (o.name && o.name.indexOf("'") !== -1) {
            o.name = o.name.replace(/'/g, "''");
            o.name = "'" + o.name + "'";
          }

          if (o.name && o.name.charAt(0) !== "'") {
            o.name = "'" + o.name + "'";
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
        var queries = [
              util.format("DROP TABLE IF EXISTS temp_%s", table),
              util.format("CREATE TABLE temp_%s (like %s)", table, table),
              util.format("CREATE INDEX temp_%s_primary_idx ON temp_%s (server, %s)", table, table, primary)
            ],
            query = queries.join('; ');

        client.query({ text: query }, function (err, result) {
          if (err) {
            logger.error("Failed queries: %s", queries.join("\n"));
            return callback(err);
          }
          return callback(null, result);
        });
      },

      function (result, callback) {
        let lastQuery;

        async.eachSeries(values, function (list, cb) {

          var query = util.format("INSERT INTO temp_%s (%s) VALUES %s", table, keys.join(', '), list);
          lastQuery = query;

          client.query({ text: query }, function (err, result) {
            if (err) {
              return cb(err);
            }
            return cb(err, result);
          });
        }, function (err, result) {
          if (err) {
            logger.error("Failed query: %s", lastQuery);
            return callback(err);
          }
          return callback(null, result);
        });

      },

      function (lastResult, callback) {
        var updateArr = [],
            updateStr = "",
            query, uStr, iStr;

        _.each(keys, function (k) {
          if (k === primary) {
            return;
          }
          updateArr.push(util.format("%s = s.%s", k.toLowerCase(), k.toLowerCase()));
        });
        updateStr = updateArr.join(', ');

        if (table === 'conquers') {
          uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.server = s.server and t.time = s.time AND t.town = s.town RETURNING s.server, s.id ) ";
          iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(server, id) WHERE t.server IS NULL AND t.id IS NULL";
          query = util.format(uStr, table, updateStr, table);
          query += util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table);
        } else {
          uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.server = s.server and t.%s = s.%s RETURNING s.server, s.%s ) ";
          iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(server, %s) WHERE t.server IS NULL AND t.%s IS NULL";
          query = util.format(uStr, table, updateStr, table, primary, primary, primary);
          query += util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table, primary, primary);
        }
        
        client.query({ text: query }, function (err, result) {
          if (err) {
            logger.error("Failed query: %s", query);
            return callback(err);
          }
          return callback(null, lastResult);
        });

      },

      function (lastResult, callback) {
        var query = util.format("DROP TABLE temp_%s", table);

        client.query({ text: query }, function (err, result) {
          if (err) {
            logger.error("Failed query: %s", query);
            return callback(err);
          }
          return callback(null, lastResult);
        });
      }

    ], function (err, result) {
      done();
      pg.end();

      if (err) {
        return callback(err);
      }
      return callback(null, result);
    });

  });
}

function dbQuery (query, callback) {

  pg.connect(dbString, function (err, client, done) {
    var handleError = function (err, callback) {
      if (!err) {
        return;
      }

      if (client) {
        done(client);
      }
      logger.error(err);
      return callback(err);
    };

    if (handleError(err, callback)) {
      return;
    }

    client.query({ text: query }, function (err, result) {
      if (err) {
        logger.error("Failed query: %s", query);
        return callback(err);
      }
      
      done();
      pg.end();
      
      if (!result.rows) {
        return callback(null, result);
      }

      return callback(null, result.rows);
    });
  });
}

exports.hourly = function (server, callback) {
  var grData = {},
      dbData = {},
      defaults = { server: server };

  async.waterfall([
    
    // get data from grepolis
    function (callback) {
      var methods = {
        players: 'getPlayersFull',
        alliances: 'getAlliancesFull',
        towns: 'getTowns',
        conquers: 'getConquers',
        islands: 'getIslands'
      },
      calls = [];

      // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(methods, function (handler, key) {
        calls.push(function (callback) {
          logger.info("Getting grepolis data for %s.", key);

          grepolis[handler](server).then(function (data) {
            grData[key] = data;
            logger.info("%s: %d", key, data.length);
            return callback();
          })
          .catch(callback);
        });
      });

      // run tasks in parallel; asynchronous
      async.parallel(calls, function(err, result) {
        if (err) {
          return callback(err);
        }
        logger.info("Finished getting data from grepolis.");
        return callback();
      });
    },

    // get data from database
    function (callback) {
      var queries = {
            players: util.format("select * from players where server = '%s' order by rank asc", server),
            alliances: util.format("select * from alliances where server = '%s' and deleted != true order by rank asc", server),
            towns: util.format("select * from towns where server = '%s'", server),
            all_alliances: util.format("select * from alliances where server = '%s' order by rank asc", server)
          },
          calls = [];

      // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(queries, function (query, key) {
        calls.push(function (callback) {
          logger.info("Getting %s data from database.", key);

          dbQuery(query, function (err, result) {
            if (err) { return callback(err); }

            result = _.indexBy(result, 'id');
            dbData[key] = result;

            return callback();
          });
        });
      });

      // run in parallel
      async.parallel(calls, function (err, result) {
        if (err) {
          return logger.error(err);
        }
        logger.info("Finished getting data from database.");
        return callback();
      });
    },

    // Import alliance member changes
    function (callback) {
      var now = Math.floor( new Date() / 1000);

      var changes = _.filter(grData.players, function (o) {
        if (!dbData.players[o.id]) {
          return;
        }
        return o.alliance !== dbData.players[o.id].alliance;
      });

      changes = _.map(changes, function (o) {
        var player = dbData.players[o.id],
            oldAlly = dbData.all_alliances[player.alliance] || null,
            newAlly = dbData.alliances[o.alliance] || null;

        player = player ? _.clone(player) : null;
        oldAlly = oldAlly ? _.clone(oldAlly) : null;
        newAlly = newAlly ? _.clone(newAlly) : null;

        if (!oldAlly) { oldAlly = { id: 0, name: "" }; }
        if (!newAlly) { newAlly = { id: 0, name: "" }; }

        if (oldAlly.name && oldAlly.name.indexOf("'") !== -1) {
          oldAlly.name = oldAlly.name.replace(/'/g, "''");
          oldAlly.name = "'" + oldAlly.name + "'";
        }
        if (oldAlly.name && oldAlly.name.charAt(0) !== "'") {
          oldAlly.name = "'" + oldAlly.name + "'";
        }

        if (newAlly.name && newAlly.name.indexOf("'") !== -1) {
          newAlly.name = newAlly.name.replace(/'/g, "''");
          newAlly.name = "'" + newAlly.name + "'";
        }
        if (newAlly.name && newAlly.name.charAt(0) !== "'") {
          newAlly.name = "'" + newAlly.name + "'";
        }

        if (o.name && o.name.indexOf("'") !== -1) {
          o.name = o.name.replace(/'/g, "''");
          o.name = "'" + o.name + "'";
        }
        if (o.name && o.name.charAt(0) !== "'") {
          o.name = "'" + o.name + "'";
        }

        return {
          server: o.server,
          player: o.id,
          time: now,
          player_name: o.name,
          old_alliance: oldAlly.id || 0,
          new_alliance: newAlly.id || 0,
          old_alliance_name: oldAlly.name || "''",
          new_alliance_name: newAlly.name || "''"
        };
      });

      if (!changes || !changes.length) {
        return callback();
      }

      var keys = Object.keys(changes[0]),
          config = _.extend(defaults, { table: 'alliance_member_changes', keys: keys, data: changes });

      logger.info('Importing %d alliance member changes.', changes.length);
      dbInsert(config, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

    // update disbanded alliances
    function (callback) {

      var grAllianceIds = _.pluck(grData.alliances, 'id'),
          dbAllianceIds = _.pluck(dbData.alliances, 'id');

      grAllianceIds = _.map(grAllianceIds, function (n) { return parseInt(n,10); });
      dbAllianceIds = _.map(dbAllianceIds, function (n) { return parseInt(n,10); });

      var deleted = _.difference(dbAllianceIds, grAllianceIds);

      if (!deleted || !deleted.length) {
        logger.info('Skipping disbanded alliances, no change.');
        return callback();
      }

      var query = util.format("update alliances set deleted = true where server = '%s' and id in (%s)", server, deleted.join(','));

      logger.info("Updating disbanded alliances");
      dbQuery(query, function (err, result) {
        if (err) { return callback(err); }
        logger.info("Finished disbanded alliances");
        return callback();
      });
    },

    // import grepo data
    function (callback) {
      var imports = [
            'players',
            'alliances',
            'towns',
            'islands'
          ],
          calls = [];

      // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(imports, function (key) {
        calls.push(function (callback) {
          var data = _.clone(grData[key]),
              keys = Object.keys(data[0]),
              config = _.extend(defaults, { table: key, keys: keys, data: data });

          logger.info("Importing %s", key);
          dbUpsert(config, function (err, result) {
            if (err) {
              return callback(err);
            }
            logger.info("Finished importing %s", key);
            return callback();
          });
        });
      });

      // run tasks in parallel; asynchronous
      async.parallel(calls, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

    // import conquers
    function (callback) {
      var data = _.clone(grData.conquers);

      if (!data || !data.length)
        return callback(null, {});

      // Add id field and value since auto increment doesn't work without it
      data = _.map(data, function (o) {
        var tmp = { id: "nextval('conquers_id_seq')" };
        o = _.extend(tmp, o);
        return o;
      });

      var keys = Object.keys(data[0]),
          config = _.extend(defaults, { table: 'conquers', keys: keys, data: data });

      logger.info('Importing conquers');
      dbUpsert(config, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

    // map deltas back to players from db
    function (callback) {
      var now = Math.floor( new Date() / 1000);

      var players = _.map(grData.players, function (p) {
        var o = dbData.players[p.id];
        
        if (!o) {
          o = p;
        }

        p.time = now;
        p.towns_delta = p.towns - o.towns;
        p.points_delta = p.points - o.points;
        p.abp_delta = p.abp - o.abp;
        p.dbp_delta = p.dbp - o.dbp;

        return p;
      });

      return callback(null, players);
    },

    // insert player updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = _.extend(defaults, { table: 'player_updates', keys: keys, data: data });

      logger.info('Importing player updates');
      dbInsert(config, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

    // map deltas back to alliances from db
    function (callback) {
      var now = Math.floor( new Date() / 1000);

      var alliances = _.map(grData.alliances, function (a) {
        var o = dbData.alliances[a.id];
        
        if (!o) {
          o = a;
        }

        a.time = now;
        a.abp = a.abp || 0;
        a.dbp = a.dbp || 0;
        a.towns_delta = a.towns - o.towns;
        a.points_delta = a.points - o.points;
        a.members_delta = a.members - o.members;
        a.abp_delta = a.abp - o.abp;
        a.dbp_delta = a.dbp - o.dbp;

        return a;
      });

      return callback(null, alliances);
    },

    // insert alliance updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = _.extend(defaults, { table: 'alliance_updates', keys: keys, data: data });

      logger.info('Importing alliance updates');
      dbInsert(config, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

  ], function (err, result) {
    if (err) {
      return callback(err);
    }
    return callback(null, result);
  });
};

exports.daily = function (server, callback) {
  var grData = {},
      dbData = {},
      defaults = { server: server },
      time = new Date() / 1000,
      lastUpdate = time - 86400 - 300,
      updateTime = (new Date() / 1000) - 300;

  async.waterfall([

    // get last update time
    function (callback) {
      var query = "select lastdaily from settings";

      dbQuery(query, function (err, result) {
        if (err) {
          return callback(err);
        }

        lastUpdate = result[0].lastdaily;
        return callback(null);
      });
    },

    // get data from grepolis
    function (callback) {
      var methods = {
        players: 'getPlayersFull',
        alliances: 'getAlliancesFull'
      },
      calls = [];

       // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(methods, function (handler, key) {
        calls.push(function (callback) {
          logger.info("Getting grepolis data for %s.", key);

          grepolis[handler](server).then(function (data) {
            grData[key] = data;
            logger.info("%s: %d", key, data.length);
            return callback();
          })
          .catch(callback);
        });
      });

      // run tasks in parallel; asynchronous
      async.parallel(calls, function(err, result) {
        if (err) {
          return callback(err);
        }
        logger.info("Finished getting data from grepolis.");
        return callback();
      });
    },

    // get data from database
    function (callback) {
      var queries = {
        players: util.format("select * from player_daily where server = '%s' and time > %d order by rank asc", server, lastUpdate),
        alliances: util.format("select * from alliance_daily where server = '%s' and time > %d order by rank asc", server, lastUpdate),
        towns: util.format("select * from towns where server = '%s'", server),
        all_alliances: util.format("select * from alliances where server = '%s' order by rank asc", server)
      },
      calls = [];

      // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(queries, function (query, key) {
        calls.push(function (callback) {
          logger.info("Getting %s data from database.", key);

          dbQuery(query, function (err, result) {
            if (err) { return callback(err); }

            result = _.indexBy(result, 'id');
            dbData[key] = result;

            return callback();
          });
        });
      });

      // run in parallel
      async.parallel(calls, function (err, result) {
        if (err) {
          return logger.error(err);
        }
        logger.info("Finished getting data from database.");
        return callback();
      });
    },

    // map deltas back to players from db
    function (callback) {
      var now = Math.floor( new Date() / 1000);

      var players = _.map(grData.players, function (p) {
        var o = dbData.players[p.id];
        
        if (!o) {
          o = p;
        }

        p.time = now;
        p.towns_delta = p.towns - o.towns;
        p.points_delta = p.points - o.points;
        p.abp_delta = p.abp - o.abp;
        p.dbp_delta = p.dbp - o.dbp;

        return p;
      });

      return callback(null, players);
    },

    // insert player updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = _.extend(defaults, { table: 'player_daily', keys: keys, data: data });

      logger.info('Importing player updates.');
      dbInsert(config, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    },

    // map deltas back to alliances from db
    function (callback) {
      var now = Math.floor( new Date() / 1000);

      var alliances = _.map(grData.alliances, function (a) {
        var o = dbData.alliances[a.id];
        
        if (!o) {
          o = a;
        }

        a.time = now;
        a.abp = a.abp || 0;
        a.dbp = a.dbp || 0;
        a.towns_delta = a.towns - o.towns;
        a.points_delta = a.points - o.points;
        a.members_delta = a.members - o.members;
        a.abp_delta = a.abp - o.abp;
        a.dbp_delta = a.dbp - o.dbp;

        return a;
      });

      return callback(null, alliances);
    },

    // insert alliance updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = _.extend(defaults, { table: 'alliance_daily', keys: keys, data: data });

      logger.info('Importing alliance updates');
      dbInsert(config, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback(null, result);
      });
    },

    function (data, callback) {
      var query = util.format("update settings set lastdaily = %s", updateTime);

      dbQuery(query, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback(null, result);
      });
    }

  ], function (err, result) {
    if (err) {
      logger.error(err);
      return callback(err);
    }
    return callback(null, result);
  });
};

exports.cleanup = function (callback) {

  async.waterfall([

    // remove old player updates (14 days)
    function (callback) {
      var diff = 14 * 24 * 60 * 60,
          time = new Date() / 1000,
          cutoff = Math.round(time - diff - 3600),
          query = util.format("delete from player_updates where time < %d", cutoff);

      logger.info("Removing old player updates");
      dbQuery(query, function (err, result) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

    // remove old alliance updates (14 days)
    function (callback) {
      var diff = 14 * 24 * 60 * 60,
          time = new Date() / 1000,
          cutoff = Math.round(time - diff - 3600),
          query = util.format("delete from player_updates where time < %d", cutoff);

      logger.info("Removing old alliance updates");
      dbQuery(query, function (err) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    },

    // remove old alliance member changes (60 days)
    function (callback) {
      var diff = 60 * 24 * 60 * 60,
          time = new Date() / 1000,
          cutoff = Math.round(time - diff - 3600),
          query = util.format("delete from alliance_member_changes where time < %d", cutoff);

      logger.info("Removing old alliance member changes");
      dbQuery(query, function (err) {
        if (err) {
          return callback(err);
        }
        return callback();
      });
    }

    ], function (err) {
      if (err) {
        logger.error(err);
        return callback(err);
      }
      return callback(null);
    });
};

exports.init = function (arg, callback) {
  logger = require('./logger')({
    consoleLabel: 'import',
    tags: ['import', arg]
  });

  var query = "select * from worlds order by server asc";

  logger.info('Fetching worlds');
  dbQuery(query, function (err, result) {
    if (err) {
      return callback(err);
    }

    var servers = _.pluck(result, 'server');

    logger.info('Starting import');

    async.eachSeries(servers, function (server, iteratorCallback) {
      logger.info("Importing world data for %s at %s.\n", server, new Date());

      if (arg == 'hourly') {
        logger.info("starting hourly update");
        exports.hourly(server, function (err, result) {
          if (err) {
            return iteratorCallback(err);
          }
          logger.info("Import completed for %s at %s.\n", server, new Date());
          return iteratorCallback();
        });
      } else if (arg === 'daily') {
        logger.info("starting daily update");
        exports.daily(server, function (err, result) {
          if (err) {
            return iteratorCallback(err);
          }
          logger.info('import completed for %s at %s', server, new Date());
          return iteratorCallback();
        });
      } else if (arg === 'cleanup') {
        logger.info("starting cleanup");
        exports.cleanup(server, function (err, result) {
          if (err) {
            return iteratorCallback(err);
          }
          logger.info('cleanup completed for %s at %s', server, new Date());
          return iteratorCallback();
        });
      }

    }, function (err) {
      if (err) {
        return logger.error(err);
      }
      logger.info('Finished all imports');

      exports.cleanup(function () {
        logger.info('Finished cleanup');
      });

    });
  });
};

