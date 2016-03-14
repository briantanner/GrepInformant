'use strict';

const util = require('util');
const moment = require('moment');
const accounting = require('accounting');
const BaseController = require('./base');

let utils = require('../lib/utils'),
    models = require('../models'),
    sequelize = models.sequelize,
    logger = require('../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    }),
    defaults = { title: 'Grepolis Tools' };

class Player extends BaseController {

  constructor() {
    super();

    return {
      players: {
        method: 'get',
        name: 'players',
        uri: '/:server/players',
        handler: this.players.bind(this)
      },
      player: {
        method: 'get',
        name: 'player',
        uri: '/:server/player/:playerId',
        handler: this.player.bind(this)
      }
    };
  }

  // players route handler
  players(req, res) {
    let server = req.params.server;

    models.Player.findAll({ where: { server: server } })
      .then(players => {
        return res.send(200, players);
      })
      .catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
  }

  // player route handler
  player(req, res) {
    let server = req.params.server,
        playerId = utils.sanitizeName(req.params.playerId),
        column = (!isNaN(playerId)) ? 'id' : 'name',
        where = { server: server },
        data = {};

    where[column] = playerId;

    models.Player.find({
      where: where,
      include: [
        { model: models.Alliance,
          as: 'Alliance',
          where: sequelize.literal('"Player".alliance = "Alliance".id'),
          attributes: ['id', 'name']
        },
        { model: models.Town,
          as: 'Towns',
          where: sequelize.literal('"Towns".player = "Player".id'),
          attributes: ['id', 'name', 'points'],
          required: false
        }
      ]
    })
    .then(player => {
      let start = (new Date() / 1000) - 604800,
          options = {};

      if (player.alliance === 0) {
        player.Alliance = player.Alliance || { name: '' };
      }

      player.alliance = player.Alliance;
      player.points = accounting.formatNumber(player.points);
      player.abp = accounting.formatNumber(player.abp);
      player.dbp = accounting.formatNumber(player.dbp);

      delete player.Alliance;

      options = {
        where: {
          server: server,
          id: player.id,
          time: { $gte: start }
        },
        order: 'time DESC'
      };

      // get player updates
      super.getPlayerUpdates(options)
      .then(updates => {

        updates = updates.map(function (o) {
          o = o.toJSON();
          o.time = moment.unix(o.time).format("DD/MM/Y HH") + ":00";
          o.points_delta = accounting.formatNumber(o.points_delta);
          o.abp_delta = accounting.formatNumber(o.abp_delta);
          o.dbp_delta = accounting.formatNumber(o.dbp_delta);
          return o;
        });

        player.updates = updates;

        data = {
          title: util.format('Player: %s (%s)', player.name, server),
          player: player
        };

        return res.render('player', data);
      })
      .catch(err => {
        logger.error(err);
        return res.send(500, err);
      });

    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

}

module.exports = new Player();
