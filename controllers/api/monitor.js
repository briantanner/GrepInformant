'use strict';

const _ = require('underscore');
const BaseController = require('../base');

let models = require('../../models'),
    logger = require('../../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    });

class Monitor extends BaseController {

  constructor() {
    super();

    return {
      playerUpdates: {
        method: 'get',
        name: 'api.monitor.updates',
        uri: '/api/v1/:server/monitor/updates',
        handler: this.playerUpdates.bind(this)
      },
      conquers: {
        method: 'get',
        name: 'api.monitor.conquers',
        uri: '/api/v1/:server/monitor/conquers',
        handler: this.conquers.bind(this)
      },
      allianceChanges: {
        method: 'get',
        name: 'api.monitor.allianceChanges',
        uri: '/api/v1/:server/monitor/allianceChanges',
        handler: this.allianceChanges.bind(this)
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
          { newally: { $in: alliances.split(',') } },
          { oldally: { $in: alliances.split(',') } }
        ]
      });
    }

    super.getConquers(where)
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

  allianceChanges(req, res) {
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
          { new_alliance: { $in: alliances.split(',') } },
          { old_alliance: { $in: alliances.split(',') } }
        ]
      });
    }

    models.AllianceMemberChanges.findAll({
      where: where
    })
    .then(changes => {
      return res.send(200, changes);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }
}

module.exports = new Monitor();
