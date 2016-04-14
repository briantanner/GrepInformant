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
        Player.hasMany(models.Conquers, { foreignKey: 'server', as: 'Conquers' });
      },

      /**
       * Get player
       * @param  {Object} options 
       * @return {Promise}         resolves a player object
       */
      getPlayer: (options) => {
        return new Promise((resolve, reject) => {
          Player.find(options.query)
          .then(player => {
            player = player.toJSON();

            if (player.alliance === 0) {
              player.Alliance = player.Alliance || { name: '' };
            }

            player.points = accounting.formatNumber(player.points);
            player.abp = accounting.formatNumber(player.abp);
            player.dbp = accounting.formatNumber(player.dbp);

            // parse updates
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

            // parse conquers
            if (player.Conquers) {
              player.Conquers = player.Conquers.map(o => {

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
            }

            return resolve(player);
          })
          .catch(reject);
        });
      },
      
      getAll: (options) => {
        return new Promise((resolve, reject) => {
          Player.findAndCountAll({
            where: { server: options.server },
            order: 'rank ASC',
            limit: options.limit,
            offset: options.offset,
            include: [{
              model: sequelize.models.Alliance, as: 'Alliance',
              where: sequelize.literal('"Player".alliance = "Alliance".id'),
              attributes: ['id', 'name'],
              required: false
            }]
          }).then(result => {
            
            result.rows = result.rows.map(player => {
              player = player.toJSON();
              
              player.rank = accounting.formatNumber(player.rank);
              player.points = accounting.formatNumber(player.points);
              player.allbp = accounting.formatNumber(player.abp + player.dbp);
              player.abp = accounting.formatNumber(player.abp);
              player.dbp = accounting.formatNumber(player.dbp);
              
              return player;
            });
            
            return resolve(result);
          }).catch(reject);
        });
      }
    }
  });

  return Player;
};