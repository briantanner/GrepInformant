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

    let handleError = function (err) {
      logger.error(err);
      return res.send(500, err);
    };

    // get alliance and members
    models.Alliance.find({
      where: {
        server: server,
        id: allyId
      },
      include: [{
        model: models.Player,
        as: 'Members',
        where: { alliance: allyId }
      }]
    })
    .then(alliance => {

      let playerIds  = _.pluck(alliance.Members, 'id'), // player ids array
          start = ((new Date() / 1000) - (168 * 60 * 60)) - 300, // 7 days, 168 hours : null,
          data = {},
          options = {};

      options = {
        where: {
          server: server,
          alliance: alliance.id,
          time: { $gte: start }
          // id: { $any: playerIds } // removed for performance
        }
      };

      // get player updates
      super.getPlayerUpdates(options)
      .then(updates => {
        let players = {};

        // map updates to players
        _.each(updates, o => {
          if (!players[o.id]) {
            players[o.id] = [];
          }
          players[o.id].push(o.toJSON());
        });

        // reduce updates and sum values
        players = _.map(players, (arr, key) => {
          arr = _.sortBy(arr, o => { return o.time; });

          return {
            id: _.first(arr).id,
            name: _.first(arr).name,
            abp: _.reduce(arr, (num,o) => { return num + parseInt(o.abp_delta,10); }, 0),
            dbp: _.reduce(arr, (num,o) => { return num + parseInt(o.dbp_delta,10); }, 0),
            allbp: _.reduce(arr, (num,o) => { return num + parseInt(o.abp_delta,10) + parseInt(o.dbp_delta,10); }, 0),
            points: _.reduce(arr, (num,o) => { return num + parseInt(o.points_delta,10); }, 0),
            towns: _.last(arr).towns,
            towns_delta: _.reduce(arr, (num,o) => { return num + parseInt(o.towns_delta,10); }, 0)
          };

        });

        // build template context data
        data = {
          title: util.format("Alliance Activity: %s", alliance.name),
          alliance: alliance,
          players: _.sortBy(players, o => { return o.allbp; }).reverse(),
          server: server,
          accounting: accounting,
          sum: {
            points: _.reduce(players, (n,o) => { return n + o.points; }, 0),
            towns: _.reduce(players, (n,o) => { return n + o.towns; }, 0),
            towns_delta: _.reduce(players, (n,o) => { return n + o.towns_delta; }, 0),
            abp: _.reduce(players, (n,o) => { return n + o.abp; }, 0),
            dbp: _.reduce(players, (n,o) => { return n + o.dbp; }, 0),
            allbp: _.reduce(players, (n,o) => { return n + o.allbp; }, 0)
          }
        };

        // render view
        return res.render('allyactivity', data);
      })
      .catch(handleError);
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
        where = { server: server },
        startTime, endTime;

    let handleError = function (err) {
      logger.error(err);
      return res.send(500, err);
    };

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

    super.getConquers(where)
    .then(conquers => {
      let data = {
        title: "Alliance Conquers",
        ally: _.sample(conquers).newally,
        server: server,
        totalConquers: conquers.length,
        conquers: conquers
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
        startTime, endTime;

    let handleError = function (err) {
      logger.error(err);
      return res.send(500, err);
    };

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

    super.getConquers(where)
    .then(conquers => {
      let data = {
        title: "Alliance Losses",
        ally: _.sample(conquers).newally,
        server: server,
        totalLosses: conquers.length,
        losses: conquers
      };

      data.cqCount = _.countBy(conquers, o => { return o.oldally.name; });
      data.cqCount = _.chain(data.cqCount)
        .map((o,i) => { return { ally: i, count: o }; })
        .filter(o => { return o.count >= 10; })
        .sortBy('count')
        .reverse()
        .value();

      return res.render('allylosses', _.extend(defaults, data));

    })
    .catch(handleError);
  }
}

module.exports = new Alliance();
