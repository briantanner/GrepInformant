'use strict';

const util = require('util');
const crypto = require('crypto');
const moment = require('moment');

let models = require('../../models'),
    sequelize = models.sequelize,
    logger = require('../../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    });

class Map {

  constructor() {
    return {
      map: {
        method: 'get',
        uri: '/api/v1/:server/map',
        handler: this.getMap.bind(this)
      },
      createSearch: {
        method: 'post',
        uri: '/api/v1/:server/map/search',
        handler: this.createSearch.bind(this)
      },
      settings: {
        method: 'get',
        uri: '/api/v1/:server/map/settings',
        handler: this.getSettings.bind(this)
      }
    };
  }

  getSearch(id) {
    return new Promise((resolve, reject) => {
      models.Search.find({
        where: { id: id }
      })
      .then(search => {
        if (!search) {
          return resolve();
        }

        return resolve(search);
      })
      .catch(err => {
        return reject(err);
      });
    });
  }

  updateLastUsed(search) {
    let time = Math.floor(new Date() / 1000);
    
    search.updateAttributes({
      last_used: time
    })
    .then(() => {
      return logger.info("Updated last_used for search (%s)", search.id);
    })
    .catch(err => {
      return logger.error(err);
    });
  }

  getSettings(req, res) {
    let server = req.params.server,
        id = req.query.id || null;

    this.getSearch(id)
      .then(search => {
        if (!search) {
          return res.send(500, 'Map not found.');
        }

        search = search.toJSON();
        search.options = JSON.parse(search.options);

        return res.send(200, search);
      })
      .catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
  }

  createSearch(req, res) {
    let server = req.params.server,
        ally = req.body.ally,
        player = req.body.player;
      
    if (!ally.length && !player.length) {
      return res.send(500, 'Nothing to search');
    }

    let sha256 = crypto.createHash("sha1", "utf8"),
        time = Math.floor( new Date() / 1000),
        hashKey = time + ally.concat(player).join(","),
        id;

    sha256.update(hashKey);
    id = sha256.digest('hex');

    models.Search
      .build({
        id: id,
        time: time,
        options: JSON.stringify(req.body)
      })
      .save()
      .then(() => {
        return res.send(200, { id: id });
      })
      .catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
  }

  /* Get map
   * TODO: Incomplete, control flow will need work to void deep nesting
   */
  getMap(req, res) {
    let server = req.params.server,
        id = req.query.id || null,
        allyId = req.query.alliance || null,
        playerId = req.query.player || null;

    if (!id) {
      return res.send(500, 'No valid id.');
    }

    this.getSearch(id)
    .then(search => {
      if (!search) {
        return res.send(500, 'Map not found.');
      }

      this.updateLastUsed(search);
      return search;
    })
    .then(search => {
      if (!search.options.player || search.options.player.length === 0) {
        return search;
      }

      models.Player.findAll({
        where: {
          $in: [search.options.player]
        },
        include: [{
          model: models.Town,
          as: 'Town',
          where: sequelize.literal('"Towns".player = "Player".id'),
          attributes: ['id', 'name', 'x', 'y']
        }],
        attributes: ['id', 'name']
      })
      .then(players => {
        return res.send(200, players);
      });
    });

  }
}

module.exports = new Map();
