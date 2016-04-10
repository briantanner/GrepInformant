'use strict';

const _ = require('underscore');
const moment = require('moment');
const escape = require('pg-escape');
const utils = require('../../lib/utils');
const models = require('../../models');
const player = require('../player');
const logger = require('../../lib/logger')({
  consoleLabel: 'web',
  tags: ['web']
});

let sequelize = models.sequelize;

class Player {

  constructor() {
    return {
      player: {
        method: "get",
        name: "api.player",
        uri: "/api/v1/:server/player/:playerId",
        handler: this.getPlayer.bind(this)
      }
    };
  }

  getPlayer(req, res) {
    let server = req.params.server,
        playerId = req.params.playerId,
        column = (!isNaN(playerId)) ? 'id' : 'name',
        where = { server: server },
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
          attributes: ['id', 'name'],
          required: false
        },
        { model: models.PlayerUpdates,
          as: 'PlayerUpdates',
          where: sequelize.literal('"Player".id = "PlayerUpdates".id'),
          attributes: ['time', 'abp_delta', 'dbp_delta', 'towns_delta', 'points_delta'],
          required: false
        }
      ]
    };

    models.Player.getPlayer(config)
    .then(player => {
      player.Updates = player.Updates.slice(0,12).reverse();

      player.Updates = player.Updates.map(o => {
        o.time = moment.unix(o.time).format("HH:00:00");
        return o;
      });

      return res.send(200, player);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }
}

module.exports = new Player();
