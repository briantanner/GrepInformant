'use strict';

const _ = require('underscore');
const util = require('util');
const moment = require('moment');

let models = require('../models'),
    sequelize = models.sequelize;

class BaseController {

  // Get player updates
  getPlayerUpdates(options) {
    return new Promise((resolve, reject) => {

      models.PlayerUpdates.findAll(options)
      .then(updates => {
        return resolve(updates);
      })
      .catch(err => {
        return reject(err);
      });

    });
  }

  // Get conquers
  getConquers(where) {

    return new Promise((resolve, reject) => {

      models.Conquers.findAll({
        where: where,
        order: 'time DESC',
        include: [
          { model: models.Player, as: 'newPlayerObj',
            where: sequelize.literal('"Conquers".newplayer = "newPlayerObj".id'),
            attributes: ["id", "name"],
            required: false
          },
          { model: models.Player, as: 'oldPlayerObj', 
            where: sequelize.literal('"Conquers".oldplayer = "oldPlayerObj".id'), 
            attributes: ["id", "name"],
            required: false
          },
          { model: models.Alliance, as: 'newAllyObj', 
            where: sequelize.literal('"Conquers".newally = "newAllyObj".id'), 
            attributes: ["id", "name"],
            required: false
          },
          { model: models.Alliance, as: 'oldAllyObj', 
            where: sequelize.literal('"Conquers".oldally = "oldAllyObj".id'), 
            attributes: ["id", "name"],
            required: false
          },
          { model: models.Town, as: 'townObj', 
            where: sequelize.literal('"Conquers".town = "townObj".id'), 
            attributes: ["id", "name", "x", "y"],
            required: false
          }
        ]
      })
      .then(conquers => {
        conquers = conquers.map(o => { return o.toJSON(); });
        conquers = conquers.map(o => {
          o.time = moment.unix(o.time).format("Y-MM-DD HH:mm:ss");
          o.newplayer = (o.newplayer) ? o.newPlayerObj : { id: 0, name: 'Ghost'};
          o.oldplayer = (o.oldplayer) ? o.oldPlayerObj : { id: 0, name: 'Ghost'};
          o.newally = (o.newally) ? o.newAllyObj : { id: 0, name: 'No Alliance'};
          o.oldally = (o.oldally) ? o.oldAllyObj : { id: 0, name: 'No Alliance'};
          o.town = (o.town) ? o.townObj : { id: 0, name: 'Unknown'};
          o.ocean = util.format("%s%s", Math.floor(o.townObj.x/100), Math.floor(o.townObj.y/100));
          o = _.omit(o, ['newPlayerObj', 'oldPlayerObj', 'newAllyObj', 'oldAllyObj', 'townObj']);

          return o;
        });

        return resolve(conquers);
      })
      .catch(reject);
    });
  }

}

module.exports = BaseController;
