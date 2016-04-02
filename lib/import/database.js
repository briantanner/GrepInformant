"use strict";

const _ = require('underscore');
const fs = require('fs');
const pg = require('pg').native;
const path = require('path');
const async = require('async');
const escape = require('pg-escape');
const format = require('string-format');
const logger = require('../logger')({
  consoleLabel: 'import',
  tags: ['import', 'database']
});

// load .env file if exists
if (fs.existsSync(path.join(process.env.PWD, '.env'))) {
  require('dotenv').load();
}

// let dbString = process.env.HEROKU_POSTGRESQL_CHARCOAL_URL;
let dbString = process.env.HEROKU_POSTGRESQL_TEAL_URL;

class Database {

  /**
   * Connect to postgres
   * 
   * @param  {Function} callback Connect callback
   */
  connect(callback) {
    pg.connect(dbString, (err, client, done) => {

      let handleError = (err, callback) => {
        if (!err) { return; }

        if (client) { done(client); }

        logger.error(err);
        return callback(err);
      };

      if (handleError(err, callback)) { return; }

      return callback(err, client, done);
    });
  }

  query(query, callback) {

    // connect to postgres
    this.connect((err, client, done) => {

      client.query({ text: query }, (err, result) => {
        done();
        
        if (err) {
          logger.error(format("Failed query: {}", query));
          return callback(err);
        }
        
        if (!result.rows) {
          return callback(null, result);
        }

        return callback(null, result.rows);
      });
    });
  }

  /**
   * Format bulk insert values
   * 
   * @param  {Array} data Values collection
   * @return {Array}      Partitioned array of values
   */
  formatValues(data) {
    return _.chain(data)
      .groupBy((el, i) => {
        return Math.floor(i/100);
      })
      .toArray()
      .map(list => {
        list = _.map(list, o => {
          let vals = _.values(o).map(val => {
            if (typeof val === 'number' || val.indexOf('nextval') !== -1) {
              return val;
            }
            return escape.literal(val);
          });

          return format('({})', _.values(vals).join(', '));
        });

        return list.join(', ');
      })
      .value();
  }

  /**
   * Bulk insert for import
   * 
   * @param  {Object}   config   Config object
   * @param  {Function} callback (err, result)
   */
  insert(config, callback) {
    let table = config.table,
        keys = config.keys,
        data = config.data,
        lastQuery, values;

    values = this.formatValues(data);
    keys = keys.map(k => { return escape("%I", k); });

    // connect to postgres
    this.connect((err, client, done) => {

      let closeClient = () => {
        done();
      };

      // iterate over values
      async.eachSeries(values, (list, cb) => {

        let query = format("INSERT INTO {table} ({keys}) VALUES {values}", {
          table: table,
          keys: keys.join(', '),
          values: list
        });

        lastQuery = query;

        client.query({ text: query }, (err, result) => {
          closeClient();

          if (err) {
            return cb(err);
          }
          return cb();
        });

      }, (err) => {
        closeClient();

        if (err) {
          logger.error(format("Failed query: {}", lastQuery));
          return callback(err);
        }
        
        return callback();
      });
    });
  }

  upsert(config, callback) {
    let table = config.table,
        primary = config.primary || 'id',
        keys = config.keys,
        data = config.data,
        server = config.server,
        tempTable = "temp_" + table + "_" + server,
        lastQuery, values;

    values = this.formatValues(data);
    keys = keys.map(k => { return escape("%I", k); });

    // connect to postgres
    this.connect((err, client, done) => {

      let closeClient = () => {
        done();
      };

      async.waterfall([

        function (callback) {
          let queries = [
            format("DROP TABLE IF EXISTS {}", tempTable),
            format("CREATE TABLE {} (like {})", tempTable, table),
            format("CREATE INDEX {0}_primary_idx ON {0} (server, {1})", tempTable, primary)
          ],
          query = queries.join('; ');

          client.query({ text: query }, (err, result) => {

            if (err) {
              closeClient();
              logger.error(format("Failed queries: {}", queries.join("\n")));
              return callback(err);
            }
            return callback(null, result);
          });
        },

        function (result, callback) {
          let lastQuery;

          async.eachSeries(values, (list, cb) => {

            let query = format("INSERT INTO {} ({}) VALUES {}", tempTable, keys.join(', '), list);
            lastQuery = query;

            client.query({ text: query }, (err, result) => {
              if (err) {
                closeClient();
                return cb(err);
              }
              return cb(err, result);
            });
          }, (err, result) => {
            if (err) {
              logger.error(format("Failed query: {}", lastQuery));
              return callback(err);
            }
            return callback(null, result);
          });

        },

        function (lastResult, callback) {
          let updateArr = [],
              query, updateStr, insertStr;

          _.each(keys, (k) => {
            if (k === primary) { return; }
            updateArr.push(format("{} = s.{}", k.toLowerCase(), k.toLowerCase()));
          });

          if (table === 'conquers') {
            
            // build upsert query
            query = "WITH upd AS ( " +
              "UPDATE {table} t SET {update} FROM {temp} s " +
              "WHERE t.server = s.server and t.time = s.time AND t.town = s.town RETURNING s.server, s.id ) " +
              "INSERT INTO {table} ({keys}) " +
              "SELECT {keys} FROM {temp} s LEFT JOIN upd u USING(server, id) " +
              "WHERE u.server IS NULL AND u.id IS NULL";

          } else {
            
            // build upsert query
            query = "WITH upd AS ( " +
              "UPDATE {table} t SET {update} FROM {temp} s " +
              "WHERE t.server = s.server and t.{primary} = s.{primary} RETURNING s.server, s.{primary} ) " +
              "INSERT INTO {table} ({keys}) " +
              "SELECT {keys} FROM {temp} s LEFT JOIN upd t USING(server, {primary}) " +
              "WHERE t.server IS NULL AND t.{primary} IS NULL";

          }

          query = format(query, {
            table: table,
            primary: primary || null,
            keys: keys.join(',').toLowerCase(),
            temp: tempTable,
            update: updateArr.join(',')
          });
          
          client.query({ text: query }, (err, result) => {
            if (err) {
              closeClient();
              logger.error(format("Failed query: {}", query));
              return callback(err);
            }
            return callback();
          });

        },

        function (callback) {
          let query = format("DROP TABLE {}", tempTable);

          client.query({ text: query }, (err, result) => {
            if (err) {
              closeClient();
              logger.error(format("Failed query: {}", query));
              return callback(err);
            }
            return callback();
          });
        }

      ], err => {
        closeClient();

        if (err) {
          return callback(err);
        }
        return callback();
      });

    });
  }
}

module.exports = new Database();
