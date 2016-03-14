'use strict';

var _ = require('underscore'),
    util = require('util'),
    models = require('../models'),
    logger = require('./logger')({
      consoleLabel: 'web',
      tags: ['web']
    });
    // Data = require('./model');

class Middleware {

  worlds(req, res, next) {
    models.Worlds.findAll({})
      .then(worlds => {
        res.locals.worlds = worlds;
        return next();
      })
      .catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
  }

  server(req, res, next) {
    models.Alliance.findAll({
      where: {
        server: req.params.server,
        deleted: false
      },
      order: 'rank ASC'
    })
    .then(alliances => {
      res.app.locals({
        server: req.params.server,
        alliances: alliances
      });
      return next();
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

}

module.exports = new Middleware();
