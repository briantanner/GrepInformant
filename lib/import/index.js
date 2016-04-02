'use strict';

const _ = require('underscore');
const async = require('async');
const db = require('./database');
const Importer = require('./importer');
// const logger = require('../logger');

let logger;

class Import {

  /**
   * Constructor
   * @param  {String} type Import type <hourly, daily, islands>
   */
  constructor(type) {
    this.type = type;
    this.servers = [];
    this.concurrency = 5;

    if (type === 'islands') {
      this.concurrency = 3;
    }

    logger = require('../logger')({
      consoleLabel: 'import',
      tags: ['import', type ]
    });
  }

  /**
   * Start import
   * @return {Promise} Promise
   */
  start() {
    return new Promise((resolve, reject) => {
      this.getServers()
          .then(this.createQueue.bind(this))
          .then(() => {
            logger.info("Finished all imports");
            return resolve();
          })
          .catch(err => {
            logger.error(err);
            return resolve();
          });
    });
  }

  /**
   * Create server import queue
   * @return {Promise} Promise
   */
  createQueue() {
    return new Promise((resolve, reject) => {
      let importQueue = async.queue(this.processQueue.bind(this), this.concurrency);

      // push imports to queue
      importQueue.push(this.servers, err => {
        if (err) {
          return reject(err);
        }
      });

      importQueue.drain = () => {
        return resolve();
      };

    });
  }

  /**
   * Process server in the queue
   * @param  {String}   server   Server id
   * @param  {Function} callback
   */
  processQueue(server, callback) {
    let importer = new Importer(server);
    
    logger.info("Importing world data for %s at %s.\n", server, new Date());

    importer[this.type]().then(() => {
      logger.info("Import completed for %s at %s.\n", server, new Date());
      return callback();
    });
  }

  /**
   * Get servers to import
   * @return {Promise} Promise
   */
  getServers() {
    return new Promise((resolve, reject) => {
      let query = "select * from worlds order by server asc";

      logger.info("Fetching worlds");
      db.query(query, (err, result) => {
        if (err) {
          return reject(err);
        }

        this.servers = _.pluck(result, 'server');

        return resolve();
      });
    });
  }
}

module.exports = Import;
