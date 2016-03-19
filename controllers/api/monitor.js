'use strict';

const _ = require('underscore');
const BaseController = require('../base');

let models = require('../../models'),
    sequelize = models.sequelize,
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
      alliances = _.map(alliances.split(','), id => { return parseInt(id, 10); });
      where.alliance = { $any: alliances };
    }

    models.PlayerUpdates.findAll({
      where: where,
      order: 'time DESC',
      limit: 3000,
      attributes: ['id', 'server', 'alliance', 'abp_delta', 'dbp_delta', 'towns_delta', 'points_delta'],
      include: [{
        model: models.Alliance,
        as: 'Alliance',
        where: sequelize.literal('"PlayerUpdates".alliance = "Alliance".id'),
        attributes: ['id', 'name'],
        required: false
      }]
    })
    .then(updates => {
      updates = _.chain(updates)
        .map(o => { return o.toJSON(); })
        .filter(o => { return o.abp_delta > 0 && o.dbp_delta > 0 })
        .groupBy('alliance')
        .value();
      
      let data = {
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
      alliances = _.map(alliances.split(','), id => { return parseInt(id, 10); });
      where = _.extend(where, {
        $or: [
          { newally: { $in: alliances } },
          { oldally: { $in: alliances } }
        ]
      });
    }

    models.Conquers.getConquers({ where })
    .then(conquers => {
      let filteredConquers = {};
      // conquers = _.map(conquers, o => { return o.toJSON(); });

      _.each(alliances, id => {
        let cqArr = _.filter(conquers, o => { return o.newally.id === id; });
        cqArr = cqArr.concat(_.filter(conquers, o => { return o.oldally.id === id; }));
        filteredConquers[id] = cqArr;
      });

      let data = {
        updates: filteredConquers
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
      alliances = _.map(alliances.split(','), id => { return parseInt(id, 10); });
      where = _.extend(where, {
        $or: [
          { new_alliance: { $in: alliances } },
          { old_alliance: { $in: alliances } }
        ]
      });
    }

    models.AllianceMemberChanges.findAll({
      where: where
    })
    .then(changes => {
      let filteredChanges = {};

      changes = changes.map(o => { return o.toJSON(); });
      console.log(alliances);
      _.each(alliances, id => {
        let chArr = _.filter(changes, o => { return o.new_alliance === id; });
        chArr = chArr.concat(_.filter(changes, o => { return o.old_alliance === id; }));
        filteredChanges[id] = chArr;
      });

      let data = {
        updates: filteredChanges
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
