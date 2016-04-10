'use strict';

const _ = require('underscore');
const util = require('util');
const moment = require('moment');
const escape = require('pg-escape');
const accounting = require('accounting');
const BaseController = require('./base');
const utils = require('../lib/utils');
const models = require('../models');
const logger = require('../lib/logger')({
  consoleLabel: 'web',
  tags: ['web']
});

let sequelize = models.sequelize,
    defaults = { title: 'Grepolis Tools' };

class Player extends BaseController {

  /**
   * Constructor
   * @return {Object} Route configuration
   */
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

  /**
   * Players handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
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

  /**
   * Player handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  player(req, res) {
    let server = req.params.server,
        playerId = req.params.playerId,
        column = (!isNaN(playerId)) ? 'id' : 'name',
        where = { server: server },
        data = {},
        config = {};

    playerId = (!isNaN(playerId)) ? parseInt(playerId, 10) : utils.sanitizeName(playerId);

    where[column] = (typeof playerId === 'number') ? playerId :
      models.sequelize.literal(escape('lower("Player".%I) = lower(%L)', column, playerId));

    config = {
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
        },
        { model: models.PlayerDaily,
          as: 'Updates',
          where: sequelize.literal('"Player".id = "Updates".id'),
          required: false
        }
      ]
    };

    models.Player.getPlayer(config)
    .then(player => {
      let start = (new Date() / 1000) - 604800,
          options = {};

      player.Updates = player.Updates.map(o => {
        o.time = moment.unix(o.time).format("Y-MM-DD");
        return o;
      });

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
  }

}

module.exports = new Player();
