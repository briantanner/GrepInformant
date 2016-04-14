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
    },
    newplayer_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    oldplayer_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    newally_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    oldally_name: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'conquers',
    classMethods: {
      associate: (models) => {
        Conquers.hasOne(models.Player, { foreignKey: 'server', as: 'newPlayerObj' });
        Conquers.hasOne(models.Player, { foreignKey: 'server', as: 'oldPlayerObj' });
        Conquers.hasOne(models.Alliance, { foreignKey: 'server', as: 'newAllyObj' });
        Conquers.hasOne(models.Alliance, { foreignKey: 'server', as: 'oldAllyObj' });
        Conquers.hasOne(models.Town, { foreignKey: 'server', as: 'Town' });
      },
      getConquers: (options) => {
        let Town = sequelize.models.Town;

        return new Promise((resolve, reject) => {
          if (!options || !options.query) {
            return reject('No query given.');
          }
          
          // build query with associations
          Conquers.findAndCountAll({
            where: options.query,
            order: options.order || 'time DESC',
            limit: options.limit || 30,
            offset: options.offset || 0,
            include: [
              { model: Town, as: 'Town', 
                where: sequelize.literal('"Conquers".town = "Town".id'), 
                attributes: ["id", "name", "x", "y"],
                required: false
              }
            ]
            // attributes: ['id', 'time', 'town', 'points', 'newplayer', 'oldplayer', 'newally', 'oldally']
          })
          .then(result => {
            // format data
            result.rows = result.rows.map(o => {
              o = o.toJSON();

              o.time = moment.unix(o.time).format("Y-MM-DD HH:mm:ss");
              o.newplayer_name = (o.newplayer) ? o.newplayer_name : 'Ghost';
              o.oldplayer_name = (o.oldplayer) ? o.oldplayer_name : 'Ghost';
              o.newally_name = (o.newally) ? o.newally_name : 'No Alliance';
              o.oldally_name = (o.oldally) ? o.oldally_name : 'No Alliance';
              o.town = (o.town) ? o.Town : { id: 0, name: 'Unknown'};
              o.ocean = Math.floor(o.Town.x/100) +""+ Math.floor(o.Town.y/100);
              delete o.Town;

              return o;
            });

            return resolve(result);
          })
          .catch(reject);

        });
      }
    }
  });
  return Conquers;
};