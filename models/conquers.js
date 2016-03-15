'use strict';

const _ = require('underscore');
const util = require('util');
const moment = require('moment');

module.exports = (sequelize, DataTypes) => {
  let Conquers = sequelize.define('Conquers', {
    id: {
      type: DataTypes.BIGINT,
      unique: true,
      allowNull: false
    },
    server: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    time: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    town: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    newplayer: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    oldplayer: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    newally: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    oldally: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'conquers',
    classMethods: {
      associate: (models) => {
        Conquers.hasOne(models.Player, { foreignKey: 'server', as: 'newPlayerObj' });
        Conquers.hasOne(models.Player, { foreignKey: 'server', as: 'oldPlayerObj' });
        Conquers.hasOne(models.Alliance, { foreignKey: 'server', as: 'newAllyObj' });
        Conquers.hasOne(models.Alliance, { foreignKey: 'server', as: 'oldAllyObj' });
        Conquers.hasOne(models.Town, { foreignKey: 'server', as: 'townObj' });
      },
      getConquers: (options) => {
        let Player = sequelize.import('./player'),
            Alliance = sequelize.import('./alliance'),
            Town = sequelize.import('./town');
        // console.log(this.__factory.associations);
        return new Promise((resolve, reject) => {
          // build query with associations
          Conquers.findAll({
            where: options.where,
            order: options.order || 'time DESC',
            limit: 3000,
            include: [
              { model: Player, as: 'newPlayerObj',
                where: sequelize.literal('"Conquers".newplayer = "newPlayerObj".id'),
                attributes: ["id", "name"],
                required: false
              },
              { model: Player, as: 'oldPlayerObj', 
                where: sequelize.literal('"Conquers".oldplayer = "oldPlayerObj".id'), 
                attributes: ["id", "name"],
                required: false
              },
              { model: Alliance, as: 'newAllyObj', 
                where: sequelize.literal('"Conquers".newally = "newAllyObj".id'), 
                attributes: ["id", "name"],
                required: false
              },
              { model: Alliance, as: 'oldAllyObj', 
                where: sequelize.literal('"Conquers".oldally = "oldAllyObj".id'), 
                attributes: ["id", "name"],
                required: false
              },
              { model: Town, as: 'townObj', 
                where: sequelize.literal('"Conquers".town = "townObj".id'), 
                attributes: ["id", "name", "x", "y"],
                required: false
              }
            ],
            attributes: ['id', 'time', 'town', 'points', 'newplayer', 'oldplayer', 'newally', 'oldally']
          })
          .then(conquers => {
            // format data
            conquers = conquers.map(o => { return o.toJSON(); });
            conquers = conquers.map(o => {
              o.time = moment.unix(o.time).format("Y-MM-DD HH:mm:ss");
              o.newplayer = (o.newplayer) ? o.newPlayerObj : { id: 0, name: 'Ghost'};
              o.oldplayer = (o.oldplayer) ? o.oldPlayerObj : { id: 0, name: 'Ghost'};
              o.newally = (o.newally) ? o.newAllyObj : { id: 0, name: 'No Alliance'};
              o.oldally = (o.oldally) ? o.oldAllyObj : { id: 0, name: 'No Alliance'};
              o.town = (o.town) ? o.townObj : { id: 0, name: 'Unknown'};
              o.ocean = Math.floor(o.townObj.x/100) +""+ Math.floor(o.townObj.y/100);
              o = _.omit(o, ['newPlayerObj', 'oldPlayerObj', 'newAllyObj', 'oldAllyObj', 'townObj']);

              return o;
            });

            return resolve(conquers);
          })
          .catch(reject);

        });
      }
    }
  });
  return Conquers;
};