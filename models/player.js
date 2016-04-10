'use strict';

const _ = require('underscore');
const moment = require('moment');
const accounting = require('accounting');

module.exports = (sequelize, DataTypes) => {
  let Player = sequelize.define('Player', {
    server: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    alliance: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    towns: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    abp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    dbp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'players',
    classMethods: {
      associate: (models) => {
        Player.hasOne(models.Alliance, { foreignKey: 'server', as: 'Alliance' });
        Player.hasMany(models.Town, { foreignKey: 'server', as: 'Towns' });
        Player.hasMany(models.PlayerUpdates, { foreignKey: 'server', as: 'PlayerUpdates' });
        Player.hasMany(models.PlayerDaily, { foreignKey: 'server', as: 'Updates' });
      },
      getPlayer: (config) => {
        return new Promise((resolve, reject) => {
          Player.find(config)
          .then(player => {
            player = player.toJSON();

            if (player.alliance === 0) {
              player.Alliance = player.Alliance || { name: '' };
            }

            player.points = accounting.formatNumber(player.points);
            player.abp = accounting.formatNumber(player.abp);
            player.dbp = accounting.formatNumber(player.dbp);

            if (player.Updates || player.PlayerUpdates) {

              player.Updates = player.Updates || player.PlayerUpdates;
              
              if (player.PlayerUpdates) {
                delete player.PlayerUpdates;
              }

              player.Updates = player.Updates.map(o => {
                o.points_delta = accounting.formatNumber(o.points_delta);
                o.abp_delta = accounting.formatNumber(o.abp_delta);
                o.dbp_delta = accounting.formatNumber(o.dbp_delta);
                return o;
              });

              player.Updates = _.sortBy(player.Updates, o => { return o.time; }).reverse();

            }

            return resolve(player);
          })
          .catch(reject);
        });
      }
    }
  });

  return Player;
};