'use strict';

const _ = require('underscore');
const util = require('util');
const moment = require('moment');

let models = require('../models'),
    sequelize = models.sequelize;

class BaseController {

  // Get player updates
  getPlayerUpdates(options) {
    return new Promise((resolve, reject) => {

      models.PlayerUpdates.findAll(options)
      .then(updates => {
        return resolve(updates);
      })
      .catch(err => {
        return reject(err);
      });

    });
  }

}

module.exports = BaseController;
