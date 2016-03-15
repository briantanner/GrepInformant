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
    models.Worlds.findAll({
      attributes: ['server', 'name']
    })
    .then(worlds => {
      worlds = worlds.map(o => { return o.toJSON(); });
      // res.locals.worlds = worlds;
      res.app.locals({ worlds: worlds });
      return next();
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  server(req, res, next) {
    if (!req.params.server) {
      return next();
    }

    models.Alliance.findAll({
      where: {
        server: req.params.server,
        deleted: false
      },
      order: 'rank ASC'
    })
    .then(alliances => {

      // set active world
      res.app.locals.worlds = res.app.locals.worlds.map(o => {
        if (o.server == req.params.server) {
          o.isActive = true;
        }
        return o;
      });

      res.app.locals({
        server: req.params.server,
        alliances: alliances.map(o => { return o.toJSON(); })
      });

      return next();
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  alliances(req, res, next) {
    if (!req.params.alliance) {
      return next();
    }

    let locals = res.app.locals;

    locals.alliances = locals.alliances.map(o => {
      if (req.params.alliance && parseInt(o.id,10) == parseInt(req.params.alliance,10)) {
        o.isActive = true;
      }
      return o;
    });

    return next();
  }

}

module.exports = new Middleware();
