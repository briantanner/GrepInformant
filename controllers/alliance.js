'use strict';

const _ = require('underscore');
const utils = require('../lib/utils');
const models = require('../models');
const moment = require('moment');
const accounting = require('accounting');
const BaseController = require('./base');
const logger = require('../lib/logger')({
  consoleLabel: 'web',
  tags: ['web']
});

let sequelize = models.sequelize,
    defaults = {
      title: 'Grepolis Tools',
      stylesheets: [ '/stylesheets/alliance.css' ],
      scripts: [ '/js/alliance.js' ]
    };

// Alliance controller
class Alliance extends BaseController {

  /**
   * Constructor
   * @return {Object} Route configuration
   */
  constructor() {
    super();

    // define routes
    return {
      alliances: {
        method: 'get',
        name: 'alliances',
        uri: '/:server/alliances/:page?',
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
        handler: this.activity.bind(this)
      },
      allianceConquers: {
        method: 'get',
        name: 'alliance.conquers',
        uri: '/:server/alliance/:alliance/conquers/:page?',
        handler: this.conquers.bind(this)
      },
      allianceLosses: {
        method: 'get',
        name: 'alliance.losses',
        uri: '/:server/alliance/:alliance/losses/:page?',
        handler: this.losses.bind(this)
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
  
  get defaults() {
    return _.clone(defaults);
  }

  /**
   * Get bounding box for ocean quad
   * @param  {String} quad  Quadrant
   * @param  {Number} ocean Ocean number
   * @return {Object}       Bounding box coords
   */
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
  
  /**
   * Get alliance by id
   * @param {Object} params request params
   * @return {Promise} resolves alliance object
   */
  getAlliance(params, getMembers) {
    return new Promise((resolve, reject) => {
      let server = params.server,
          id = utils.sanitizeName(params.alliance),
          column = (!isNaN(id)) ? 'id' : 'name',
          page = params.page || 1,
          limit = 30,
          search = {},
          options = {};
      
      id = (!isNaN(id)) ? parseInt(id,10) : id;
      search[column] = id;
      
      options = {
        query: {
          where: _.extend(search, {
            server: server,
            deleted: false
          })
        }
      };
      
      if (getMembers) {
        options.query.include = [{
          model: models.Player,
          as: 'Members',
          where: { alliance: id, deleted: false }
        }];
      }
      
      models.Alliance.getAlliance(options)
      .then(data => {
         data.title = `Alliance: ${data.name}`;
         data.isAlliance = true;
         return resolve(data);
      })
      .catch(reject);
    });
  }
  
  /**
   * Get conquers/losses
   * @param {Object} alliance alliance object
   * @param {Object} options  options to query
   */
  getConquers(alliance, options) {
    return new Promise((resolve, reject) => {
      let query = { server: alliance.server };
      
      query[options.column] = alliance.id;
          
      models.Conquers.getConquers({
        query: query,
        limit: options.limit,
        offset: (options.page-1) * options.limit
      })
      .then(result => {
        let conquers = result.rows;

        // build template context
        let data = _.extend(this.defaults, alliance, {
          subtitle: (options.type === 'losses') ? "Cities Lost" : "Cities Gained",
          totalConquers: result.count,
          Conquers: conquers,
          routeType: options.type,
          count: result.count,
          baseurl: `/${alliance.server}/alliance/${alliance.id}/${options.type}`,
          pagination: {
            page: options.page,
            pageCount: Math.ceil(result.count / options.limit)
          }
        });
        
        if (options.type === 'conquers') {
          data.isConquers = true;
        } else if (options.type === 'losses') {
          data.isLosses = true;
        }

        // return count by alliance
        // data.cqCount = _.countBy(conquers, o => { return o.oldally_name; });
        // data.cqCount = _.chain(data.cqCount)
        //   .map((o,i) => { return { ally: i, count: o }; })
        //   .filter(o => { return o.count >= 10; }) // just show alliance with >= 10 conquers
        //   .sortBy('count')
        //   .reverse()
        //   .value();

        return resolve(data);
      })
      .catch(reject);
    });
  }

  /**
   * Alliances handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  alliances(req, res) {
    let server = req.params.server,
        page = req.params.page || 1,
        limit = req.query.limit || 30;

    models.Alliance.getAll({
      query: {
        where: { server: server, deleted: false },
        order: 'rank ASC',
        limit: limit,
        offset: (page-1) * limit,
        attributes: ['id', 'name', 'rank', 'members', 'points', 'towns', 'abp', 'dbp']
      }
    })
    .then(result => {
      // build template context
      let data = _.extend(this.defaults, {
        title: `Alliances: ${server}`,
        alliances: result.rows,
        baseurl: `/${server}/alliances`,
        pagination: {
          page: page,
          pageCount: Math.ceil(result.count / limit)
        }
      });

      return res.render('alliances', data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  /**
   * Alliance handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  alliance(req, res) {
    // get alliance
    this.getAlliance(req.params, true).then(data => {

      // build template context
      data = _.extend(this.defaults, data, {
        isDefault: true
      });
      
      // render view
      return res.render('alliance', data);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  /**
   * Alliance activity handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  activity(req, res) {

    // get alliance
    this.getAlliance(req.params).then(alliance => {
      
      // get alliance activity
      models.Alliance.getActivity({
        query: { server: alliance.server, id: alliance.id },
        alliances: res.app.locals.alliances
      })
      .then(data => {

        // build template context
        data = _.extend(this.defaults, alliance, data, {
          isActivity: true
        });

        // render view
        return res.render('alliance', data);
      })
      .catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  /**
   * Alliance conquers handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  conquers(req, res) {
    let page = req.params.page || 1,
        limit = 30;
    
    this.getAlliance(req.params).then(alliance => {
      let options = {
        type: 'conquers',
        column: 'newally',
        page, limit
      };
      
      this.getConquers(alliance, options).then(data => {
        return res.render('alliance', data);
      }).catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  /**
   * Alliance losses handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  losses(req, res) {
    let page = req.params.page || 1,
        limit = 30;
    
    this.getAlliance(req.params).then(alliance => {
      let options = {
        type: 'losses',
        column: 'oldally',
        page, limit
      };
      
      this.getConquers(alliance, options).then(data => {
        return res.render('alliance', data);
      }).catch(err => {
        logger.error(err);
        return res.send(500, err);
      });
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  /**
   * Towns by quad handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
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
        title: `Alliance Targets: ${alliance.name}`,
        alliance: alliance,
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

  /**
   * Alliance intel handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  intel(req, res) {
    let server = req.params.server,
        alliance = req.params.alliance,
        allyIds = req.query.alliances || alliance,
        where = {};

    // normalize alliance id input
    allyIds = allyIds.split(',');
    allyIds = _.map(allyIds, a => { return parseInt(a); });

    if (typeof allyIds === 'string') {
      where = { server: server, id: allyIds };
    } else {
      where = { server: server, id: { $any: allyIds } };
    }

    // build query
    models.Alliance.findAll({
      where: where,
      include: [{ model: models.Player, as: 'Members',
        where: { alliance: sequelize.literal('"Members".alliance = "Alliance".id') },
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
    .then(alliances => {

      // sort order of known intel
      let sort = {
        LS: '001', Tris: '002', OLU: '003', OLUSlings: '004', OLUHorse: '005', OLUHops: '006', Chariots: '007', 
        Mantis: '008', Griffins: '009', Harpies: '09', Erinys: '010', Birs: '011', DLU: '012', Hydra: '013', Pegs: '014'
      },
      members = {};

      alliances = alliances.map(ally => { return ally.toJSON(); });
      alliances = alliances.map(alliance => {
        let _alliances = _.map(res.app.locals.alliances, _.clone);

        // set active alliance for alliance selector
        alliance.alliances = _alliances.map(o => {
          delete o.isActive;

          if (o.id === alliance.id) {
            o.isActive = true;
          }

          return o;
        });

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
        // alliance.Members = _.sortBy(alliance.Members, 'intelCount').reverse();

        // console.log(alliance.alliances.slice(0,10));

        return alliance;
      });

      // pull members from alliances, merge and sort
      members = _.chain(alliances).pluck('Members').flatten(true)
        .sortBy('intelCount').reverse().value();

      // remove members from alliances
      alliances = alliances.map(o => { return _.omit(o, 'Members'); });

      // build template context
      let data = _.extend(defaults, {
        title: "Alliance Intel",
        alliance: alliance,
        intelAlliances: alliances,
        members: members
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
