'use strict';

const _ = require('underscore');
const util = require('util');
const moment = require('moment');
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
        },
        {
          model: models.PlayerUpdates,
          as: 'PlayerUpdates',
          where: sequelize.literal('"Player".id = "PlayerUpdates".id'),
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

      player.points = accounting.formatNumber(player.points);
      player.abp = accounting.formatNumber(player.abp);
      player.dbp = accounting.formatNumber(player.dbp);

      player.PlayerUpdates = player.PlayerUpdates.map(o => {
        o = o.toJSON();
        o.time = moment.unix(o.time).format("Y-MM-DD");
        o.points_delta = accounting.formatNumber(o.points_delta);
        o.abp_delta = accounting.formatNumber(o.abp_delta);
        o.dbp_delta = accounting.formatNumber(o.dbp_delta);
        return o;
      });

      player.PlayerUpdates = _.sortBy(player.PlayerUpdates, o => { return o.time; }).reverse();

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
