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
        uri: '/:server/players/:page?',
        handler: this.players.bind(this)
      },
      player: {
        method: 'get',
        name: 'player',
        uri: '/:server/player/:playerId',
        handler: this.player.bind(this)
      },
      towns: {
        method: 'get',
        name: 'player.towns',
        uri: '/:server/player/:playerId/towns',
        handler: this.towns.bind(this)
      },
      conquers: {
        method: 'get',
        name: 'player.conquers',
        uri: '/:server/player/:playerId/conquers',
        handler: this.conquers.bind(this)
      }
    };
  }
  
  get defaults() {
    return _.clone(defaults);
  }

  /**
   * Players handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  players(req, res) {
    let server = req.params.server,
        page = req.params.page || 1,
        limit = req.query.limit || 30;

    models.Player.getAll({
      server: server,
      limit: limit,
      offset: (page-1) * limit
    }).then(result => {
      // build template context
      let data = _.extend(this.defaults, {
        title: `Players: ${server}`,
        server: server,
        players: result.rows,
        baseurl: `/${server}/alliances`,
        pagination: {
          page: page,
          pageCount: Math.ceil(result.count / limit)
        }
      });
      
      return res.render('players', data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  /**
   * Player default handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  player(req, res) {
    let server = req.params.server,
        playerId = req.params.playerId,
        column = (!isNaN(playerId)) ? 'id' : 'name',
        where = { server: server },
        data = {},
        options = {};

    playerId = (!isNaN(playerId)) ? parseInt(playerId, 10) : utils.sanitizeName(playerId);

    where[column] = (typeof playerId === 'number') ? playerId :
      models.sequelize.literal(escape('lower("Player".%I) = lower(%L)', column, playerId));

    options = {
      query: {
        where: where,
        include: [
          { model: models.Alliance, as: 'Alliance',
            where: sequelize.literal('"Player".alliance = "Alliance".id'),
            attributes: ['id', 'name'] },
          { model: models.PlayerDaily, as: 'Updates',
            where: sequelize.literal('"Player".id = "Updates".id'),
            required: false }
        ]
      }
    };

    models.Player.getPlayer(options)
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
  
  /**
   * Player towns handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  towns(req, res) {
    let server = req.params.server,
        playerId = req.params.playerId,
        column = (!isNaN(playerId)) ? 'id' : 'name',
        where = { server: server },
        data = {},
        options = {};

    playerId = (!isNaN(playerId)) ? parseInt(playerId, 10) : utils.sanitizeName(playerId);

    where[column] = (typeof playerId === 'number') ? playerId :
      models.sequelize.literal(escape('lower("Player".%I) = lower(%L)', column, playerId));

    options = {
      query: {
        where: where,
        include: [
          { model: models.Alliance, as: 'Alliance',
            where: sequelize.literal('"Player".alliance = "Alliance".id'),
            attributes: ['id', 'name'] },
          { model: models.Town, as: 'Towns',
            where: sequelize.literal('"Towns".player = "Player".id'),
            attributes: ['id', 'name', 'points', 'x', 'y'],
            required: false }
        ]
      }
    };

    models.Player.getPlayer(options)
    .then(player => {
      let start = (new Date() / 1000) - 604800,
          options = {};

      player.Towns = player.Towns.map(o => {
        o.points = accounting.formatNumber(o.points);
        o.ocean = util.format("%d%d", Math.round(o.x/100), Math.round(o.y/100));
        return o;
      });
      
      player.Towns = _.sortBy(player.Towns, o => { return o.ocean; });

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

  /**
   * Player conquers handler
   * @param {Object} req Express request
   * @param {Object} res Express response
   */
  conquers(req, res) {
    let server = req.params.server,
        playerId = req.params.playerId,
        column = (!isNaN(playerId)) ? 'id' : 'name',
        where = { server: server },
        data = {},
        options = {};

    playerId = (!isNaN(playerId)) ? parseInt(playerId, 10) : utils.sanitizeName(playerId);

    where[column] = (typeof playerId === 'number') ? playerId :
      models.sequelize.literal(escape('lower("Player".%I) = lower(%L)', column, playerId));

    options = {
      query: {
        where: where,
        include: [
          { model: models.Alliance, as: 'Alliance',
            where: sequelize.literal('"Player".alliance = "Alliance".id'),
            attributes: ['id', 'name'] },
          { model: models.Conquers, as: 'Conquers',
            where: {
              $or: [
                sequelize.literal('"Player".id = "Conquers".newplayer'),
                sequelize.literal('"Player".id = "Conquers".oldplayer')
              ],
            },
            order: 'time DESC',
            include: [{ model: models.Town, as: 'Town', 
              where: sequelize.literal('"Conquers".town = "Conquers.Town".id'), 
              attributes: ["id", "name", "x", "y"],
              required: false
            }],
            required: false
          }
        ]
      }
    };

    models.Player.getPlayer(options)
    .then(player => {
      let start = (new Date() / 1000) - 604800,
          options = {};
      
      player.Conquers = _.sortBy(player.Conquers, o => { return o.time; }).reverse();

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
