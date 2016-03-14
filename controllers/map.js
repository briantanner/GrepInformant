'use strict';

const _ = require('underscore');
const util = require('util');
const moment = require('moment');

let utils = require('../lib/utils'),
    models = require('../models'),
    sequelize = models.sequelize,
    logger = require('../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    }),
    defaults = { title: 'Grepolis Tools' };

class Map {

  constructor() {
    return {
      map: {
        method: 'get',
        uri: '/:server/map/:id?',
        handler: this.getMap.bind(this)
      }
    };
  }

  getMap(req, res) {
    let server = req.params.server,
        id = req.params.id || req.query.id || req.query.q || null;

    if (!id) {
      return res.render('mapCanvas');
    }

    models.Search.find({ where: { id: id } })
      .then(search => {
        let data = {};

        if (!search && !search.length) {
          data.id = null;
          data.error = "This map doesn't exist.";

          return res.render('mapCanvas', data);
        }

        search = search.toJSON();
        search.options = JSON.parse(search.options);

        return res.render('mapCanvas', data);
      });
  }

}

module.exports = new Map();
