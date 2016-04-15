"use strict";

const _ = require('underscore');
const fs = require('fs');
// const util = require('util');
const async = require('async');
const format = require('string-format');
const escape = require('pg-escape');
const grepolis = require('./grepolis');
const db = require('./database');
const models = require('../../models');
const logger = require('../logger')({
  consoleLabel: 'import',
  tags: ['import']
});

const columns = {
  players: ['server', 'id', 'name', 'alliance', 'points', 'rank', 'towns', 'abp', 'dbp', 'deleted'],
  alliances: ['server', 'id', 'name' , 'points', 'rank', 'towns', 'members', 'abp', 'dbp', 'deleted'],
  towns: ['server', 'id', 'player', 'name', 'points', 'x', 'y', 'islandno', 'deleted'],
  conquers: ['server', 'id', 'time', 'town', 'points', 'newplayer', 'oldplayer', 'newally', 'oldally', 'newplayer_name', 'oldplayer_name', 'newally_name', 'oldally_name'],
  player_daily: ['server', 'id', 'time', 'name', 'alliance', 'rank', 'points', 'abp', 'dbp', 'towns', 'abp_delta', 'dbp_delta', 'towns_delta', 'points_delta'],
  alliance_daily: ['server', 'id', 'time', 'name', 'members', 'rank', 'points', 'abp', 'dbp', 'towns', 'abp_delta', 'dbp_delta', 'towns_delta', 'points_delta'],
};


class Importer {

  /**
   * Construtor
   * @param  {String} server Server id
   */
  constructor(server) {
    this.server = server;
    this.grepolis = {};
    this.data = {};
    this.defaults = { server: server };
    this.lastUpdate = 0;
    this.updateTime = 0;
  }

  /**
   * Hourly import process
   * @return {Promise} Promise
   */
  hourly() {
    this.update = 'hourly';

    return new Promise(resolve => {
      this.info(format("Starting {} import.", this.update));

      this.getGrepolisData(['players', 'alliances', 'conquers', 'towns'])
          .then(this.getDatabaseData.bind(this))
          .then(this.allianceMemberChanges.bind(this))
          .then(this.updateDeleted.bind(this, 'alliances'))
          .then(this.updateDeleted.bind(this, 'players'))
          .then(this.updateDeleted.bind(this, 'towns'))
          .then(this.importData.bind(this, ['players', 'alliances', 'towns']))
          .then(this.importConquers.bind(this))
          .then(this.importUpdates.bind(this, 'player'))
          .then(this.importUpdates.bind(this, 'alliance'))
          .then(() => {
            
            // cleanup
            delete this.grepolis;
            delete this.data;

            this.info(format("Finished {} import.", this.update));
            return resolve();
          })
          .catch(err => {
            this.error(err);
            logger.error(err.stack);
            return resolve();
          });
    });
  }

  /**
   * Island import process
   * @return {Promise} Promise
   */
  islands() {
    this.update = 'islands';

    return new Promise(resolve => {
      this.info(format("Starting {} import.", this.update));

      this.getGrepolisData(['islands'])
          .then(this.importData.bind(this, ['islands']))
          .then(() => {
            this.info(format("Finished {} import.", this.update));
            return resolve();
          })
          .catch(err => {
            this.error(err);
            logger.error(err.stack);
            return resolve();
          });
    });
  }
  
  /**
   * Daily import process
   * @return {Promise} Promise
   */
  daily() {
    let time = new Date() / 1000;

    this.update = 'daily';
    this.lastUpdate = time - 86400 - 300;
    this.updateTime = (new Date() / 1000) - 300;

    return new Promise(resolve => {
      this.info(format("Starting {} import.", this.update));

      this.getLastUpdate(this.lastUpdate)
          .then(this.getGrepolisData.bind(this, ['players', 'alliances']))
          .then(this.getDatabaseData.bind(this, null, this.lastUpdate))
          .then(this.importUpdates.bind(this, 'alliance'))
          .then(this.importUpdates.bind(this, 'player'))
          .then(this.setLastUpdate.bind(this, 'lastdaily', this.updateTime))
          .then(this.purgeUpdates.bind(this, 'player_updates', 14))
          .then(this.purgeUpdates.bind(this, 'alliance_updates', 14))
          .then(this.purgeUpdates.bind(this, 'alliance_member_changes', 30))
          .then(() => {
            return resolve();
          })
          .catch(err => {
            this.error(err);
            logger.error(err.stack);
            return resolve();
          });
    });
  }

  /**
   * Cleanup process
   * @return {Promise} Promise
   */
  cleanup() {
    return new Promise(resolve => {
      this.info("Starting cleanup.");

      this.getGrepolisData(['players', 'alliances', 'conquers', 'towns'])
          .then(this.getDatabaseData.bind(this))
          .then(this.updateDeleted.bind(this, 'alliances'))
          .then(this.updateDeleted.bind(this, 'players'))
          .then(this.updateDeleted.bind(this, 'towns'))
          .then(this.purgeUpdates.bind(this, 'player_updates', 14))
          .then(this.purgeUpdates.bind(this, 'alliance_updates', 14))
          .then(this.purgeUpdates.bind(this, 'alliance_member_changes', 30))
          .then(() => {
            delete this.grepolis;
            delete this.data;

            this.info("Finished cleanup.");
            return resolve();
          })
          .catch(err => {
            this.error(err);
            logger.error(err.stack);
            return resolve();
          });
    });
  }

  /**
   * Manual process to update names in the conquers table.
   */
  addConquerNames() {
    return new Promise(resolve => {
      this.getDatabaseData(['players', 'alliances', 'conquers'], null, true)
          .then(this.updateConquers.bind(this))
          .then(() => {
            delete this.data;

            this.info("Finished adding conquer names");
            return resolve();
          })
          .catch(err => {
            this.error(err);
            logger.error(err.stack);
            return resolve();
          });
    });
  }

  /**
   * Info logging wrapper
   * @param  {String} message
   */
  info(message) {
    logger.info("[%s] %s", this.server, message);
  }

  /**
   * Error logging wrapper
   * @param  {String} message
   */
  error(message) {
    logger.error("[%s] %s", this.server, message);
  }

  /**
   * Get last update time from setting
   * @param  {String} col Column name
   * @return {Promise}    Promise
   */
  getLastUpdate(col) {
    return new Promise((resolve, reject) => {
      let query = escape("select %s from settings", col);

      db.query(query, (err, result) => {
        if (err) {
          return reject(err);
        }

        this.lastUpdate = result[0][col];
        return resolve();
      });
    });
  }

  /**
   * Update last update time in settings
   * @param {String} col   column name
   * @param {Number} value Unix timestamp
   * @return {Promise}     Promise
   */
  setLastUpdate(col, value) {
    return new Promise((resolve, reject) => {
      let query = escape("update settings set %I = %L", col, Math.round(value));

      db.query(query, function (err, result) {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  /**
   * Get grepolis data
   * @param  {Array} keys Array of methods to query
   * @return {Promise}    Promise
   */
  getGrepolisData(keys) {
    return new Promise((resolve, reject) => {
      let calls = [],
          methods = {
            players: 'getPlayersFull',
            alliances: 'getAlliancesFull',
            towns: 'getTowns',
            conquers: 'getConquers',
            islands: 'getIslands'
          };

      // only query data in key list
      if (keys) {
        methods = _.pick(methods, keys);
      }

      // add functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(methods, (handler, key) => {
        calls.push(callback => {
          this.info(format("Getting grepolis data for {}.", key));

          grepolis[handler](this.server).then(data => {
            this.grepolis[key] = data;
            this.info(format("{}: {}", key, data.length));
            return callback();
          })
          .catch(callback);
        });
      });

      // run tasks in parallel; asynchronous
      async.parallel(calls, (err, result) => {
        if (err) {
          return reject(err);
        }
        this.info("Finished getting data from grepolis.");
        return resolve();
      });

    });
  }

  /**
   * Get data from postgres
   * @return {Promise} Promise
   */
  getDatabaseData(keys, time, includeDeleted) {
    return new Promise((resolve, reject) => {
      let calls = [],
        queries = {
          players: escape("select %s from players where server = %L and deleted != true order by rank asc", columns.players.join(','), this.server),
          alliances: escape("select %s from alliances where server = %L and deleted != true order by rank asc", columns.alliances.join(','), this.server),
          towns: escape("select %s from towns where server = %L and deleted != true", columns.towns.join(','), this.server),
          conquers: escape("select %s from conquers where server = %L", columns.conquers.join(','), this.server),
          all_alliances: escape("select %s from alliances where server = %L and deleted != true order by rank asc", columns.alliances.join(','), this.server)
        };

      if (time) {
        queries = {
          players: escape("select %s from player_daily where server = %L and time > %s order by rank asc", columns.player_daily.join(','), this.server, time),
          alliances: escape("select %s from alliance_daily where server = %L and time > %s order by rank asc", columns.alliance_daily.join(','), this.server, time),
          all_alliances: escape("select %s from alliances where server = %L and deleted != true order by rank asc", columns.alliances.join(','), this.server, time)
        };
      }
      
      if (includeDeleted) {
        queries = {
          players: escape("select %s from players where server = %L order by rank asc", columns.players.join(','), this.server),
          alliances: escape("select %s from alliances where server = %L order by rank asc", columns.alliances.join(','), this.server),
          towns: escape("select %s from towns where server = %L", columns.towns.join(','), this.server),
          conquers: escape("select %s from conquers where server = %L", columns.conquers.join(','), this.server),
        }
      }

      // only query data in key list
      if (keys) {
        queries = _.pick(queries, keys);
      }

      // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(queries, (query, key) => {
        calls.push(callback => {
          this.info(format("Getting {} data from database.", key));

          db.query(query, (err, result) => {
            if (err) { return callback(err); }

            result = _.indexBy(result, 'id');
            this.data[key] = result;

            return callback();
          });
        });
      });

      // run in parallel
      async.parallel(calls, (err, result) => {
        if (err) {
          return reject(err);
        }
        this.info("Finished getting data from database.");
        return resolve();
      });

    });
  }

  /**
   * Update conquers adding names
   * @return {Promise} Promise
   */
  updateConquers() {
    return new Promise((resolve, reject) => {
      models.Conquers.findAll({
        where: {
          server: this.server
        }
      }).then(conquers => {
        let hasUpdates = false,
            updates = [];

        this.info(format('Starting update of {} conquers'));

        async.eachSeries(conquers, (conquer, callback) => {
          let update = {};

          if (conquer.newplayer !== 0 && this.data.players[conquer.newplayer]) {
            if (!conquer.newplayer_name || !conquer.newplayer_name.length)
              update.newplayer_name = this.data.players[conquer.newplayer].name;
          }
          if (conquer.oldplayer !== 0 && this.data.players[conquer.oldplayer]) {
            if (!conquer.oldplayer_name || !conquer.oldplayer_name.length)
              update.oldplayer_name = this.data.players[conquer.oldplayer].name;
          }
          if (conquer.newally !== 0 && this.data.alliances[conquer.newally]) {
            if (!conquer.newally_name || !conquer.newally_name.length)
              update.newally_name = this.data.alliances[conquer.newally].name;
          }
          if (conquer.oldally !== 0 && this.data.alliances[conquer.oldally]) {
            if (!conquer.oldally_name || !conquer.oldally_name.length)
              update.oldally_name = this.data.alliances[conquer.oldally].name;
          }

          if (!Object.keys(update).length) {
            return callback();
          }

          if (!hasUpdates) {
            hasUpdates = true;
          }

          updates.push({ conquer, update });
          return callback();
        }, () => {
          this.info(format("{} updates", updates.length));

          if (updates.length === 0) {
            this.info('skipped');
            return resolve();
          }

          let updateQueue = async.queue(function (task, callback) {
            // update conquer
            task.conquer.updateAttributes(task.update).then(() => {
              process.stdout.write(format("\[{}] updated {}\n", this.server, task.conquer.id));
              return callback();
            }).catch(err => {
              this.error(err);
              return callback();
            });
          }.bind(this), 20);

          updateQueue.drain = function () {
            this.info('finished iterating conquers');
            return resolve();
          }.bind(this);

          updateQueue.push(updates);
        });

      })
      .catch(err => {
        this.error(err);
        return resolve(err);
      });
    });
  }

  /**
   * Import alliance member changes
   * @return {Promise} Promise
   */
  allianceMemberChanges() {
    return new Promise((resolve, reject) => {
      let now = Math.floor(new Date() / 1000);

      let changes = _.filter(this.grepolis.players, o => {
        if (!this.data.players[o.id]) {
          return;
        }
        return o.alliance !== this.data.players[o.id].alliance;
      });

      changes = _.map(changes, o => {
        let player = this.data.players[o.id],
            oldAlly = this.data.all_alliances[player.alliance] || null,
            newAlly = this.data.alliances[o.alliance] || null;

        // clone objects without reference
        player = player ? _.clone(player) : null;
        oldAlly = oldAlly ? _.clone(oldAlly) : { name: '', id: 0 };
        newAlly = newAlly ? _.clone(newAlly) : { name: '', id: 0 };

        return {
          server: o.server,
          player: o.id,
          time: now,
          player_name: o.name,
          old_alliance: oldAlly.id,
          new_alliance: newAlly.id,
          old_alliance_name: oldAlly.name,
          new_alliance_name: newAlly.name
        };
      });

      if (!changes || !changes.length) {
        return resolve();
      }

      var keys = Object.keys(changes[0]),
          config = _.extend(this.defaults, {
            table: 'alliance_member_changes',
            keys: keys,
            data: changes
          });

      this.info(format('Importing {} alliance member changes.', changes.length));
      db.insert(config, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });

    });
  }

  /**
   * Updated deleted players/alliances in db
   * @param  {String} table Table name (plural)
   * @return {Promise}      Promise
   */
  updateDeleted(table) {
    return new Promise((resolve, reject) => {
      let grIds = _.pluck(this.grepolis[table], 'id'),
          dbIds = _.pluck(this.data[table], 'id'),
          deleted, query;

      grIds = _.map(grIds, n => { return parseInt(n,10); });
      dbIds = _.map(dbIds, n => { return parseInt(n,10); });

      deleted = _.difference(dbIds, grIds);

      if (!deleted || !deleted.length) {
        this.info(format('Skipping deleted {}, no change.', table));
        return resolve();
      }

      // escape values;
      deleted = deleted.map(val => {
        if (typeof val === 'number' || val.indexOf('nextval') !== -1) {
          return val;
        }
        return escape("%L", val);
      });
      // build query
      query = escape("update %s set deleted = true where server = %L and id in (%s)", table, this.server, deleted.join(','));

      this.info(format("Updating {} deleted {}", deleted.length, table));
      db.query(query, (err, result) => {
        if (err) { return reject(err); }
        this.info(format("Finished deleted {}", table));
        return resolve();
      });

    });
  }

  /**
   * Import grepolis data
   * @return {Promise} Promise
   */
  importData(keys) {
    return new Promise((resolve, reject) => {
      let calls = [],
          imports = _.shuffle([ // shuffle to lessen time spent in deadlock
            'players',
            'alliances',
            'towns',
            'islands'
          ]);

      if (keys) {
        imports = _.filter(imports, val => { return keys.indexOf(val) !== -1; });
      }

      // add call functions to array to run in parallel to prevent multiple callbacks; synchronous
      _.each(imports, key => {
        calls.push(callback => {
          let data = _.clone(this.grepolis[key]),
              keys = Object.keys(data[0]),
              config = _.extend(this.defaults, { table: key, keys: keys, data: data });

          this.info(format("Importing {}", key));
          db.upsert(config, (err, result) => {
            if (err) {
              return callback(err);
            }
            this.info(format("Finished importing {}", key));
            return callback();
          });
        });
      });

      // run tasks in parallel; asynchronous
      async.parallel(calls, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });

    });
  }

  /**
   * Import conquer data
   * @return {Promise} Promise
   */
  importConquers() {
    return new Promise((resolve, reject) => {
      let data = _.clone(this.grepolis.conquers),
          keys;

      if (!data && !data.length) {
        return resolve();
      }
      
      keys = ['id'].concat(Object.keys(data[0]));

      // Add id field and value since auto increment doesn't work without it
      data = _.map(data, o => {
        let tmp = { id: "nextval('conquers_id_seq')" };
        o = _.extend(tmp, o);

        o.newplayer_name = this.data.players[o.newPlayer.toString()] ?
          this.data.players[o.newPlayer.toString()].name : null;
        o.oldplayer_name = this.data.players[o.oldPlayer.toString()] ?
          this.data.players[o.oldPlayer.toString()].name : null;
        o.newally_name = this.data.alliances[o.newAlly.toString()] ?
          this.data.alliances[o.newAlly.toString()].name : null;
        o.oldally_name = this.data.alliances[o.oldAlly.toString()] ?
          this.data.alliances[o.oldAlly.toString()].name : null;

        return o;
      });
      
      keys = keys.concat(['newplayer_name', 'oldplayer_name', 'newally_name', 'oldally_name']);

      let config = _.extend(this.defaults, { table: 'conquers', keys: keys, data: data });

      this.info('Importing conquers');
      db.upsert(config, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });

    });
  }

  /**
   * Import updates
   * @param  {String} table Table name (singular)
   * @return {Promise}      Promise
   */
  importUpdates(table) {
    return new Promise((resolve, reject) => {
      let now = Math.floor(new Date() / 1000),
          tableName = table + ((this.update === 'daily') ? '_daily' : '_updates'),
          data = [],
          keys,
          config;
      
      table = {
        key: table + "s",
        name: tableName,
        default: table
      };

      data = _.map(this.grepolis[table.key], val => {
        let obj = this.data[table.key][val.id];
        
        if (!obj) { obj = val; }

        val.time = now;
        val.abp = val.abp || 0;
        val.dbp = val.dbp || 0;
        val.towns_delta = val.towns - obj.towns;
        val.points_delta = val.points - obj.points;
        val.abp_delta = val.abp - obj.abp;
        val.dbp_delta = val.dbp - obj.dbp;

        if (obj.members) {
          val.members_delta = obj.members - val.members;
        }

        return val;
      });

      keys = Object.keys(data[0]);
      config = _.extend(this.defaults, { table: table.name, keys: keys, data: data });

      this.info(format('Importing {} updates', table.default));
      db.insert(config, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });

    });
  }

  /**
   * Purge old updates
   * @param  {String} table     Table name (exact name)
   * @param  {Number} limit     Number of days to keep
   * @return {Promise}          Promise
   */
  purgeUpdates(table, limit) {
    return new Promise((resolve, reject) => {
      let diff = limit * 86400,
          time = new Date() / 1000,
          cutoff = Math.round(time - diff - 3600),
          query = escape("delete from %I where time < %L", table, cutoff);

      this.info(format("Removing {} updates", table));
      db.query(query, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }


}

module.exports = Importer;
