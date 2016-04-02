"use strict";

const _ = require('underscore');
const fs = require('fs');
// const util = require('util');
const async = require('async');
const format = require('string-format');
const escape = require('pg-escape');
const grepolis = require('./grepolis');
const db = require('./database');
const logger = require('../logger')({
  consoleLabel: 'import',
  tags: ['import']
});

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

      this.getGrepolisData()
          .then(this.getDatabaseData.bind(this))
          .then(this.allianceMemberChanges.bind(this))
          .then(this.updateDeleted.bind(this, 'alliances'))
          .then(this.updateDeleted.bind(this, 'players'))
          .then(this.importData.bind(this))
          .then(this.importConquers.bind(this))
          .then(this.importUpdates.bind(this, 'player'))
          .then(this.importUpdates.bind(this, 'alliance'))
          .then(() => {
            this.info(format("Finished {} import.", this.update));
            return resolve();
          })
          .catch(err => {
            this.error(err);
            console.log(err.stack);
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
          .then(this.getDatabaseData.bind(this, ['players', 'alliances']))
          .then(this.importUpdates.bind(this, 'alliance'))
          .then(this.importUpdates.bind(this, 'player'))
          .then(this.setLastUpdate.bind(this, this.updateTime))
          .then(this.purgeUpdates.bind(this, 'player_updates', 14))
          .then(this.purgeUpdates.bind(this, 'alliance_updates', 14))
          .then(this.purgeUpdates.bind(this, 'alliance_member_changes', 30))
          .then(() => {
            return resolve();
          })
          .catch(err => {
            this.error(err);
            console.log(err.stack);
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
      let query = escape("select %I from settings", col);

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
      let query = escape("update settings set %I = %L", col, value);

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
  getDatabaseData() {
    return new Promise((resolve, reject) => {
      let calls = [],
        queries = {
          players: escape("select * from players where server = %L order by rank asc", this.server),
          alliances: escape("select * from alliances where server = %L and deleted != true order by rank asc", this.server),
          towns: escape("select * from towns where server = %L", this.server),
          all_alliances: escape("select * from alliances where server = %L order by rank asc", this.server)
        };

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
   * Import alliance member changes
   * @return {Promise} Promise
   */
  allianceMemberChanges() {
    return new Promise((resolve, reject) => {
      let now = Math.floor(new Date() / 1000);

      let changes = _.filter(this.grData.players, o => {
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
        oldAlly = _.clone(oldAlly);
        newAlly = _.clone(newAlly);

        return {
          server: o.server,
          player: o.id,
          time: now,
          player_name: o.name,
          old_alliance: oldAlly.id || 0,
          new_alliance: newAlly.id || 0,
          old_alliance_name: oldAlly.name || null,
          new_alliance_name: newAlly.name || null
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
      deleted = deleted.map(val => { return escape("%L", val); });
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
  importData() {
    return new Promise((resolve, reject) => {
      let calls = [],
          imports = [
            'players',
            'alliances',
            'towns',
            'islands'
          ];

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
      let data = _.clone(this.grepolis.conquers);

      if (!data || !data.length) {
        return resolve();
      }

      // Add id field and value since auto increment doesn't work without it
      data = _.map(data, o => {
        let tmp = { id: "nextval('conquers_id_seq')" };
        o = _.extend(tmp, o);
        return o;
      });

      let keys = Object.keys(data[0]),
          config = _.extend(this.defaults, { table: 'conquers', keys: keys, data: data });

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
          data = [],
          keys,
          config;
      
      table = {
        key: table + "s",
        name: table + (this.update === 'daily') ? '_daily' : '_updates',
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
