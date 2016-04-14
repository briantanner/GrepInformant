'use strict';

const _ = require('underscore');
const moment = require('moment');
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
        Alliance.hasMany(models.Conquers, { foreignKey: 'server', as: 'Conquers' });
      },
      
      /**
       * Get alliance
       * @param {Object}  options options for search
       * @return {Promise}  resolves alliance object
       */
      getAlliance: (options) => {
        return new Promise((resolve, reject) => {
          if (!options || !options.query) {
            return reject('No query given.');
          }
           
          Alliance.find(options.query).then(alliance => {
            if (!alliance) {
              return reject('Alliance not found.');
            }
            
            alliance = alliance.toJSON();
             
            alliance.rank = accounting.formatNumber(alliance.rank);
            alliance.points = accounting.formatNumber(alliance.points);
            alliance.allbp = accounting.formatNumber(alliance.abp + alliance.dbp);
            alliance.abp = accounting.formatNumber(alliance.abp);
            alliance.dbp = accounting.formatNumber(alliance.dbp);
            alliance.towns = accounting.formatNumber(alliance.towns);
            
            alliance.Members = _.sortBy(alliance.Members, o => { return o.rank; });
            
            if (alliance.Members) {
              alliance.Members = alliance.Members.map(player => {
                
                player.rank = accounting.formatNumber(player.rank);
                player.points = accounting.formatNumber(player.points);
                player.allbp = accounting.formatNumber(player.abp + player.dbp);
                player.abp = accounting.formatNumber(player.abp);
                player.dbp = accounting.formatNumber(player.dbp);
                player.towns = accounting.formatNumber(player.towns);
                
                return player;
              });
            }
            
            return resolve(alliance);  
          })
          .catch(reject);
          
        });
      },

      /**
       * Get all alliances
       * @param  {Object} options options for search
       * @return {Promise}        resolves collection of alliances
       */
      getAll: (options) => {
        return new Promise((resolve, reject) => {
          if (!options || !options.query) {
            return reject('No query given.');
          }

          Alliance.findAndCountAll(options.query).then(result => {
            result.rows = result.rows.map(o => {
              o = o.toJSON();
              
              o.avg = {
                towns: accounting.formatNumber(o.towns / o.members),
                points: accounting.formatNumber(o.points / o.members),
                abp: accounting.formatNumber(o.abp / o.members),
                dbp: accounting.formatNumber(o.dbp / o.members),
                fighter: accounting.formatNumber((o.abp + o.dbp) / o.members)
              };

              o.rank = accounting.formatNumber(o.rank);
              o.towns = accounting.formatNumber(o.towns);
              o.points = accounting.formatNumber(o.points);
              o.abp = accounting.formatNumber(o.abp);
              o.dbp = accounting.formatNumber(o.dbp);

              return o;
            });

            return resolve(result);
          }).catch(reject);
        });
      },

      /**
       * Get alliance member activity
       * @param  {Object} options options to search
       * @return {Promise}        resolves an alliance object
       */
      getActivity: (options) => {
        let Player = sequelize.models.Player,
            PlayerDaily = sequelize.models.PlayerDaily,
            start = ((new Date() / 1000) - (168 * 60 * 60)) - 300;
        
        return new Promise((resolve, reject) => {
          if (!options || !options.query) {
            return reject('No query given.');
          }
          
          Alliance.findAll({
            where: options.query,
            include: [{ model: Player, as: 'Members',
              where: {
                alliance: sequelize.literal('"Members".alliance = "Alliance".id'),
                deleted: false
              },
              include: [{ model: PlayerDaily, as: 'Updates',
                where: {
                  time: { $gte: start },
                  id: sequelize.literal('"Members.Updates".id = "Members".id')
                },
                attributes: ['id', 'time', 'points_delta', 'abp_delta', 'dbp_delta', 'towns_delta'],
                required: false,
              }],
              attributes: ['id', 'name', 'towns'],
              required: false
            }],
            attributes: ['id', 'name']
          }).then(alliances => {
            let formatKeys = ['abp', 'dbp', 'allbp', 'points', 'towns', 'towns_delta'],
                reduce = (obj, col) => {
                  return _.reduce(obj, (num,o) => { return num + parseInt(o[col],10); }, 0);
                };

            alliances = _.map(alliances, alliance => {
              alliance = alliance.toJSON();

              let _alliances = _.map(options.alliances, _.clone);

              // set active alliance for alliance selector
              alliance.alliances = _alliances.map(o => {
                delete o.isActive;

                if (o.id === alliance.id) {
                  o.isActive = true;
                }

                return o;
              });

              alliance.Members = alliance.Members.map(player => {
                player.Updates = player.Updates || player.PlayerUpdates;

                if (player.PlayerUpdates) {
                  delete player.PlayerUpdates;
                }

                return {
                  id: player.id,
                  name: player.name,
                  towns: player.towns,
                  points: reduce(player.Updates, 'points_delta'),
                  abp: reduce(player.Updates, 'abp_delta'),
                  dbp: reduce(player.Updates, 'dbp_delta'),
                  allbp: _.reduce(player.Updates, (num, o) => { return num + o.abp_delta + o.dbp_delta; }, 0),
                  towns_delta: reduce(player.Updates, 'towns_delta')
                };
              });

              return alliance;
            });

            let members = _.chain(alliances).pluck('Members').flatten(true)
              .sortBy('allbp').reverse().value();

            members.forEach((member, i) => {
              member.rank = i+1;
            });

            let data = {
              activityAlliances: alliances,
              members: members,
              totals: {
                points: accounting.formatNumber(reduce(members, 'points')),
                towns: accounting.formatNumber(reduce(members, 'towns')),
                towns_delta: accounting.formatNumber(reduce(members, 'towns_delta')),
                abp: accounting.formatNumber(reduce(members, 'abp')),
                dbp: accounting.formatNumber(reduce(members, 'dbp')),
                allbp: accounting.formatNumber(reduce(members, 'allbp'))
              }
            };

            data.members = data.members.map(player => {
              formatKeys.forEach(key => {
                player[key] = accounting.formatNumber(player[key]);
              });
              return player;
            });

            return resolve(data);
          })
          .catch(reject);

        });
      }
    }
  });

  return Alliance;
};