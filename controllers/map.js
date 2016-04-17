'use strict';

const _ = require('underscore');
const util = require('util');
const utils = require('../lib/utils');
const moment = require('moment');
const join = require('bluebird').join;
const models = require('../models');
const logger = require('../lib/logger')({
  consoleLabel: 'web',
  tags: ['web']
});

let sequelize = models.sequelize,
    defaults = { title: 'Grepolis Tools' };

class Map {

  constructor() {
    return {
      islands: {
        method: 'get',
        name: 'islands',
        uri: '/:server/map/islands',
        handler: this.getIslands.bind(this)
      },
      map: {
        method: 'get',
        name: 'map',
        uri: '/:server/map/:playerOrAlliance?',
        handler: this.getMap.bind(this)
      }
    };
  }
  
  getIslands(req, res) {
    let server = req.params.server;
    
    models.Island.findAll({
      server: server,
      limit: 10
    }).then(islands => {
      return res.send(200, islands);
    }).catch(err => {
      return res.send(500, err);
    });
  }

  getPlayer(server, search) {
    return new Promise((resolve, reject) => {
      let where = _.extend(search, {
        server: server,
        deleted: false
      });
      
      models.Player.find({ where: where })
      .then(player => {
        if (player) {
          return resolve(player.toJSON());
        }
        
        return resolve();
      })
      .catch(reject);
    });
  }

  getAlliance(server, search) {
    return new Promise((resolve, reject) => {
      let where = _.extend(search, {
        server: server,
        deleted: false
      });
      
      models.Alliance.find({
        where: where,
        include: [{
          model: models.Player, as: 'Members',
          where: sequelize.literal('"Alliance".id = "Members".alliance'),
          required: false
        }]
      })
      .then(alliance => {
        if (alliance) {
          return resolve(alliance.toJSON());
        }
        
        return resolve();
      })
      .catch(reject);
    });
  }

  getMap(req, res) {
    let server = req.params.server,
        id = utils.sanitizeName(req.params.playerOrAlliance),
        column = (!isNaN(id)) ? 'id' : 'name',
        search = {};
      
      id = (!isNaN(id)) ? parseInt(id,10) : id;
      search[column] = id;

    if (!id) {
      return res.render('map');
    }
    
    join(
      this.getPlayer(server, search),
      this.getAlliance(server, search),
      (player, alliance) => {
        let players = [];
        
        if (alliance) {
          players = _.pluck(alliance.Members, 'id');
        }
        
        if (player) {
          players.push(player.id);
        }
        
        if (!players.length) {
          return res.render('map');
        }
        
        models.Town.getTownsForMap({ server, players })
        .then(towns => {
          let data = {
            title: `World Map (${server})`,
            minx: (towns.length) ? _.min(towns, o => { return o.x; }).x : 0,
            miny: (towns.length) ? _.min(towns, o => { return o.y; }).y : 0,
            towns: towns
          };
          
          return res.render('map', data);
        })
        .catch(err => {
          logger.error(err);
          return res.send(500, err);
        });
        
    }).catch(err => {
      console.error(err);
      return res.send(500, err);
    });
  }

}

module.exports = new Map();
