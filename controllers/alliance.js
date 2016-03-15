'use strict';

const _ = require('underscore');
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

// Alliance controller
class Alliance extends BaseController {

  constructor() {
    super();

    // define routes
    return {
      alliances: {
        method: 'get',
        name: 'alliances',
        uri: '/:server/alliances',
        handler: this.alliances.bind(this)
      },
      alliance: {
        method: 'get',
        name: 'alliance',
        uri: '/:server/alliance/:alliance',
        handler: this.alliance.bind(this)
      },
      allianceActivity: {
        method: 'get',
        name: 'alliance.activity',
        uri: '/:server/alliance/:alliance/activity',
        handler: this.allianceActivity.bind(this)
      },
      allianceConquers: {
        method: 'get',
        name: 'alliance.conquers',
        uri: '/:server/alliance/:alliance/conquers',
        handler: this.allianceConquers.bind(this)
      },
      allianceLosses: {
        method: 'get',
        name: 'alliance.losses',
        uri: '/:server/alliance/:alliance/losses',
        handler: this.allianceLosses.bind(this)
      }
    };
  }

  // alliances route handler
  alliances(req, res) {

    let server = req.params.server;

    models.Alliance.find({
      where: { server: server }
    })
    .then(alliances => {
      return res.send(200, alliances);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  // alliance route handler
  alliance(req, res) {

    let server = req.params.server,
        allyId = utils.sanitizeName(req.params.alliance),
        column = (!isNaN(allyId)) ? 'id' : 'name',
        where = { server: server },
        allySearch = {};
    
    allyId = (!isNaN(allyId)) ? parseInt(allyId,10) : allyId;
    allySearch[column] = allyId;

    models.Alliance.find({
      where: _.extend(allySearch, {
        server: server
      }),
      include: [{
        model: models.Player,
        as: 'Members',
        where: { alliance: allyId }
      }]
    })
    .then(alliance => {
      return res.send(200, alliance);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  // alliance activity route handler
  allianceActivity(req, res) {

    let server = req.params.server,
        allyId = req.params.alliance,
        start = req.query.start || null,
        end = req.query.end || null,
        hours = 168;

    start = ((new Date() / 1000) - (168 * 60 * 60)) - 300;

    let handleError = function (err) {
      logger.error(err);
      return res.send(500, err);
    };

    // build query
    models.Alliance.getActivity({
      where: { server: server, id: allyId },
      include: [{ model: models.Player, as: 'Members',
        where: { alliance: allyId },
        include: [{ model: models.PlayerUpdates, as: 'PlayerUpdates',
          where: {
            time: { $gte: start },
            id: sequelize.literal('"Members.PlayerUpdates".id = "Members".id')
          },
          attributes: ['id', 'time', 'points_delta', 'abp_delta', 'dbp_delta', 'towns_delta'],
          required: false,
        }],
        attributes: ['id', 'name', 'towns'],
        required: false
      }],
      attributes: ['id', 'name']
    })
    .then(alliance => {

      // build template context
      let data = {
        title: util.format("Alliance Activity: %s", alliance.name),
        alliance: alliance,
        server: server,
        totals: alliance.totals
      };

      // render view
      return res.render('allyactivity', data);
    })
    .catch(handleError);
  }

  // alliance conquers route handler
  allianceConquers(req, res) {

    let server = req.params.server,
        alliance = req.params.alliance,
        start = req.query.start || null,
        end = req.query.end || null,
        hideInternals = req.query.hideinternals || null,
        hasStart = start,
        where = { server: server },
        options, startTime, endTime;

    let handleError = function (err) {
      logger.error(err);
      return res.send(500, err);
    };

    if (!start) {
      start = moment.unix(moment().format('X') - 2592000); // 30 day limit
    }

    startTime = (start) ? moment(start).format('X') : null;
    endTime = (end) ? moment(end).format('X') : null;

    // build query
    if (alliance)
      where.newally = alliance;
    if (hideInternals)
      where.oldally = { $ne: alliance };
    if (startTime)
      where.time = { $gte: startTime };
    if (endTime)
      where.time = { $lte: endTime };

    models.Conquers.getConquers({ where: where })
    .then(conquers => {
      let data = {
        title: "Alliance Conquers",
        subtitle: "Cities Gained",
        ally: _.sample(conquers).newally,
        server: server,
        totalConquers: conquers.length,
        conquers: conquers,
        hasStartTime: hasStart,
        routeType: 'conquers'
      };

      data.cqCount = _.countBy(conquers, o => { return o.oldally.name; });
      data.cqCount = _.chain(data.cqCount)
        .map((o,i) => { return { ally: i, count: o }; })
        .filter(o => { return o.count >= 10; })
        .sortBy('count')
        .reverse()
        .value();

      return res.render('allyconquers', _.extend(defaults, data));

    })
    .catch(handleError);
  }

  // alliance losses route handler
  allianceLosses(req, res) {

    let server = req.params.server,
        alliance = req.params.alliance,
        start = req.query.start || null,
        end = req.query.end || null,
        where = { server: server },
        hasStart = start,
        startTime, endTime;

    let handleError = function (err) {
      logger.error(err);
      return res.send(500, err);
    };

    if (!start) {
      start = moment.unix(moment().format('X') - 2592000); // 30 day limit
    }

    startTime = (start) ? moment(start).format('X') : null;
    endTime = (end) ? moment(end).format('X') : null;

    // build query
    if (alliance) {
      where.oldally = alliance;
      where.newally = { $ne: alliance };
    }

    if (startTime)
      where.time = { $gte: startTime };
    if (endTime)
      where.time = { $lte: endTime };

    models.Conquers.getConquers({ where: where })
    .then(conquers => {
      let data = {
        title: "Alliance Losses",
        subtitle: "Cities Lost",
        ally: _.sample(conquers).newally,
        server: server,
        totalConquers: conquers.length,
        conquers: conquers,
        hasStartTime: hasStart,
        routeType: 'losses'
      };

      data.cqCount = _.countBy(conquers, o => { return o.newally.name; });
      data.cqCount = _.chain(data.cqCount)
        .map((o,i) => { return { ally: i, count: o }; })
        .filter(o => { return o.count >= 10; })
        .sortBy('count')
        .reverse()
        .value();

      return res.render('allyconquers', _.extend(defaults, data));

    })
    .catch(handleError);
  }
}

module.exports = new Alliance();