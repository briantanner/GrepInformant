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
    defaults = {
      title: 'Grepolis Tools',
      stylesheets: [ '/stylesheets/alliance.css' ],
      scripts: [ '/js/alliance.js' ]
    };

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
      },
      intel: {
        method: 'get',
        name: 'alliance.intel',
        uri: '/:server/alliance/:alliance/intel',
        handler: this.intel.bind(this)
      },
      townsByQuad: {
        method: 'get',
        name: 'alliance.towns.byquad',
        uri: '/:server/alliance/:alliance/:quad/:ocean',
        handler: this.townsByQuad.bind(this)
      }
    };
  }

  getBounds(quad, ocean) {
    let x = parseInt(ocean.split('')[0],10),
        y = parseInt(ocean.split('')[1],10),
        w = 33,
        h = 33,
        quads = {
          'nw': [0,0],
          'nc': [33,0],
          'ne': [67,0],
          'cw': [0,33],
          'cc': [33,33],
          'ce': [67,33],
          'sw': [0,67],
          'sc': [33,67],
          'se': [67,67]
        },
        bounds;

    quad = quads[quad];
    bounds = {
      x1: (x*100)+quad[0],
      y1: (y*100)+quad[1],
      x2: (x*100)+quad[0]+w,
      y2: (y*100)+quad[1]+h
    };

    return bounds;
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
      let data = _.extend(defaults, {
        title: util.format("Alliance Activity: %s", alliance.name),
        alliance: alliance,
        server: server,
        totals: alliance.totals
      });

      // render view
      return res.render('alliance/activity', data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
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

    // set 30 day limit for performance
    if (!start) {
      start = moment.unix(moment().format('X') - 2592000);
    }

    // convert YYYY-MM-DD to unix timestamps
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

      // build template context
      let data = {
        title: util.format("Alliance Conquers: %s", _.sample(conquers).newally.name),
        subtitle: "Cities Gained",
        ally: _.sample(conquers).newally,
        server: server,
        totalConquers: conquers.length,
        conquers: conquers,
        hasStartTime: hasStart,
        routeType: 'conquers'
      };

      // return count by alliance
      data.cqCount = _.countBy(conquers, o => { return o.oldally.name; });
      data.cqCount = _.chain(data.cqCount)
        .map((o,i) => { return { ally: i, count: o }; })
        .filter(o => { return o.count >= 10; }) // just show alliance with >= 10 conquers
        .sortBy('count')
        .reverse()
        .value();

      return res.render('alliance/conquers', _.extend(defaults, data));
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
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

    // set 30 day limit for performance
    if (!start) {
      start = moment.unix(moment().format('X') - 2592000); // 30 day limit
    }

    // convert YYYY-MM-DD to unix timestamps
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

      // build template context
      let data = _.extend(defaults, {
        title: util.format("Alliance Losses: %s", _.sample(conquers).oldally.name),
        subtitle: "Cities Lost",
        ally: _.sample(conquers).newally,
        server: server,
        totalConquers: conquers.length,
        conquers: conquers,
        hasStartTime: hasStart,
        routeType: 'losses'
      });

      // return count by alliance
      data.cqCount = _.countBy(conquers, o => { return o.newally.name; });
      data.cqCount = _.chain(data.cqCount)
        .map((o,i) => { return { ally: i, count: o }; })
        .filter(o => { return o.count >= 10; })
        .sortBy('count')
        .reverse()
        .value();

      return res.render('alliance/conquers', data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  townsByQuad(req, res) {

    let server = req.params.server,
        allyId = req.params.alliance,
        quad = req.params.quad,
        ocean = req.params.ocean;

    // build query
    models.Alliance.find({
      where: { server: server, id: allyId },
      include: [{ model: models.Player, as: 'Members',
        where: { alliance: allyId },
        include: [{ model: models.Town, as: 'Towns',
          where: {
            id: sequelize.literal('"Members.Towns".player = "Members".id')
          },
          required: false,
        }],
        attributes: ['id', 'name', 'towns'],
        required: false
      }],
      attributes: ['id', 'name']
    })
    .then(alliance => {

      let bounds = this.getBounds(quad, ocean);

      alliance = alliance.toJSON();
      alliance.Members = alliance.Members.map(player => {
        // filter towns outside of quad
        player.Towns = player.Towns.filter(town => {
          let filter = town.x >= bounds.x1 &&
                       town.x < bounds.x2 &&
                       town.y >= bounds.y1 &&
                       town.y < bounds.y2;
          return filter;
        });

        // count towns in quad
        player.townsInQuad = player.Towns.length;
        player.ratio = Math.round((player.townsInQuad / player.towns) * 100);

        return player;
      });

      // sort members by towns in quad and remove those with none
      alliance.Members = _.chain(alliance.Members)
        .filter(o => { return o.townsInQuad > 0; })
        .sortBy(o => { return o.townsInQuad; }).value().reverse();

      // build template context
      let data = _.extend(defaults, {
        title: util.format("Alliance Targets: %s", alliance.name),
        alliance: alliance,
        server: server,
        bounds: bounds,
        quad: quad,
        ocean: ocean,
        quads: [ 'nw', 'nc', 'ne', 'cw', 'cc', 'ce', 'sw', 'sc', 'se' ]
      });

      return res.render('alliance/quad', data);
    })
    .catch(err => {
      console.error(err);
      return res.send(500, err);
    });
  }

  intel(req, res) {

    let server = req.params.server,
        allyId = req.params.alliance;

    // build query
    models.Alliance.find({
      where: { server: server, id: allyId },
      include: [{ model: models.Player, as: 'Members',
        where: { alliance: allyId },
        include: [{ model: models.Town, as: 'Towns',
          where: { id: sequelize.literal('"Members.Towns".player = "Members".id') },
          include: [{ model: models.TownIntel, as: 'Intel',
            where: { id: sequelize.literal('"Members.Towns".id = "Members.Towns.Intel".id') },
            required: false
          }],
          required: false
        }],
        attributes: ['id', 'name', 'towns'],
        required: false
      }],
      attributes: ['id', 'name']
    })
    .then(alliance => {

      // sort order of known intel
      let sort = {
        LS: '001', Tris: '002', OLU: '003', OLUSlings: '004', OLUHorse: '005', OLUHops: '006', Chariots: '007', 
        Mantis: '008', Griffins: '009', Harpies: '09', Erinys: '010', Birs: '011', DLU: '012', Hydra: '013', Pegs: '014'
      };

      alliance = alliance.toJSON();
      alliance.Members = alliance.Members.map(player => {
        // sort towns by known intel
        player.Towns = _.sortBy(player.Towns, town => {
          if (town.Intel) {
            return sort[town.Intel.intel.replace('/', '')] + town.name;
          }

          return 'Z' + town.name;
        });
        
        // add number of towns with intel
        player.intelCount = _.reduce(player.Towns, (num, town) => {
          return num + ((town.Intel) ? 1 : 0);
        }, 0);

        // percentage of known towns
        player.intelCoverage = Math.round((player.intelCount / player.towns) * 100);

        return player;
      });

      // sort members by known intel count
      alliance.Members = _.sortBy(alliance.Members, 'intelCount').reverse();

      // build template context
      let data = _.extend(defaults, {
        title: util.format("Alliance Intel: %s", alliance.name),
        alliance: alliance,
        members: alliance.Members,
        server: server
      });

      return res.render('alliance/intel', data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }
}

module.exports = new Alliance();
