'use strict';

const _ = require('underscore');
const accounting = require('accounting');

let utils = require('../lib/utils');

module.exports = (sequelize, DataTypes) => {
  let Alliance = sequelize.define('Alliance', {
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
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    towns: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    members: {
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
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  }, {
    tableName: 'alliances',
    timestamps: false,
    classMethods: {
      associate: models => {
        Alliance.hasMany(models.Player, { foreignKey: 'server', as: 'Members' });
      },
      getActivity: (options) => {
        return new Promise((resolve, reject) => {
          
          Alliance.find(options)
          .then(alliance => {
            let formatKeys = ['abp', 'dbp', 'allbp', 'points', 'towns', 'towns_delta'];
            let reduce = (obj, col) => {
              return _.reduce(obj, (num,o) => { return num + parseInt(o[col],10); }, 0);
            };
            
            alliance = alliance.toJSON();
            alliance.Members = alliance.Members.map(player => {
              return {
                id: player.id,
                name: player.name,
                towns: player.towns,
                points: reduce(player.PlayerUpdates, 'points_delta'),
                abp: reduce(player.PlayerUpdates, 'abp_delta'),
                dbp: reduce(player.PlayerUpdates, 'dbp_delta'),
                allbp: _.reduce(player.PlayerUpdates, (num, o) => { return num + o.abp_delta + o.dbp_delta; }, 0),
                towns_delta: reduce(player.PlayerUpdates, 'towns_delta')
              };
            });

            alliance.Members = _.sortBy(alliance.Members, (o) => { return o.allbp; }).reverse();
            alliance.Members.forEach((member, i) => {
              member.rank = i+1;
            });

            alliance.totals = {
              points: accounting.formatNumber(reduce(alliance.Members, 'points')),
              towns: accounting.formatNumber(reduce(alliance.Members, 'towns')),
              towns_delta: accounting.formatNumber(reduce(alliance.Members, 'towns_delta')),
              abp: accounting.formatNumber(reduce(alliance.Members, 'abp')),
              dbp: accounting.formatNumber(reduce(alliance.Members, 'dbp')),
              allbp: accounting.formatNumber(reduce(alliance.Members, 'allbp'))
            };

            alliance.Members = alliance.Members.map(player => {
              formatKeys.forEach(key => {
                player[key] = accounting.formatNumber(player[key]);
              });
              return player;
            });

            return resolve(alliance);
          })
          .catch(reject);

        });
      }
    }
  });

  return Alliance;
};