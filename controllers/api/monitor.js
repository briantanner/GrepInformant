'use strict';

const _ = require('underscore');
const BaseController = require('../base');

let models = require('../../models'),
    logger = require('../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    });

class Monitor extends BaseController {

  constructor() {
    super();

    return {
      playerUpdates: {
        method: 'get',
        uri: '/api/v1/monitor/playerUpdates',
        handler: this.playerUpdates.bind(this)
      },
      conquers: {
        method: 'get',
        uri: '/api/v1/monitor/conquers',
        handler: this.conquers.bind(this)
      }
    };
  }

  playerUpdates(req, res) {
    let server = req.params.server,
        time = req.query.time || null,
        alliances = req.query.alliances || null,
        where = { server: server };

    if (!time) {
      return res.send(500, 'Time parameter required.');
    }

    where.time = { $gte: time };
    if (alliances) {
      where.alliance = { $any: alliances };
    }

    models.PlayerUpdates.findAll({
      where: where,
      order: 'time DESC'
    })
    .then(updates => {
      updates = updates.map(o => { return o.toJSON(); });
      
      let data = {
        count: updates.length,
        updates: updates
      };

      return res.send(200, data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  conquers(req, res) {
    let server = req.params.server,
        time = req.query.time || null,
        alliances = req.query.alliances || null,
        where = { server: server };

    if (!time) {
      return res.send(500, 'Time parameter required.');
    }

    where.time = { $gte: time };
    if (alliances) {
      where = _.extend(where, {
        $or: [
          { newally: { $in: alliances } },
          { oldally: { $in: alliances } }
        ]
      });
    }

    super.getConquers({ where: where })
    .then(conquers => {
      let data = {
        count: conquers.length,
        updates: conquers
      };

      return res.send(200, data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }
}

module.exports = new Monitor();
