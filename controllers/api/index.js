'use strict';

let models = require('../../models'),
    sequelize = models.sequelize,
    logger = require('../../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    });

class Index {

  constructor() {
    return {
      autocomplete: {
        method: 'get',
        name: 'api.autocomplete',
        uri: '/api/v1/:server/autocomplete/:table',
        handler: this.autocomplete.bind(this)
      }
    };
  }

  autocomplete(req, res) {
    let server = req.params.server,
        table = req.params.table || 'players',
        input = req.query.input.replace(/'/g, "''") || null;

    if (!input || input.length < 3) {
      return res.send(200, null);
    }

    models.Player.findAll({
      where: { $like: sequelize.fn('lower', sequelize.col('name'), input.toLowerString()) },
      attributes: ['id', 'name']
    })
    .then(players => {
      players = players.map(o => { return o.toJSON(); });
      return res.send(200, players);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }
}

module.exports = new Index();
