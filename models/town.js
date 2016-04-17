'use strict';

const _ = require('underscore');
const join = require('bluebird').join;

module.exports = (sequelize, DataTypes) => {
  let Town = sequelize.define('Town', {
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
    player: {
      type: DataTypes.INTEGER,
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
    x: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    y: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    islandno: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'towns',
    classMethods: {
      associate: models => {
        Town.hasOne(models.Player, { foreignKey: 'server', as: 'Player' });
        Town.hasOne(models.TownIntel, { foreignKey: 'server', as: 'Intel' });
        Town.hasOne(models.Island, { foreignKey: 'server', as: 'Island' });
      },
      
      getTownsForMap: options => {
        return new Promise((resolve, reject) => {
          var Player = sequelize.models.Player,
              Island = sequelize.models.Island,
              Offsets = sequelize.models.Offsets,
              where = {},
              playerWhere = {};
          
          playerWhere = sequelize.literal('"Town".player = "Player".id');
          
          if (options.alliance) {
            playerWhere = {
              $and: [ sequelize.literal('"Town".player = "Player".id'), { alliance: options.alliance } ]
            };
          }
          
          if (options.players) {
            where = {
              server: options.server,
              player: { $any: options.players }
            };
          }
          
          // inner join islands i on t.server = i.server and t.x = i.x and t.y = i.y
          // inner join offsets o on i.type = o.id and t.islandNo = o.pos
          
          join(
            Town.findAll({
              where: where,
              include: [
                { model: Player, as: 'Player',
                  where: playerWhere,
                  attributes: ['id', 'name', 'alliance'],
                  required: false },
                { model: Island, as: 'Island',
                  where: {
                    $and: [
                      sequelize.literal('"Town".x = "Island".x'),
                      sequelize.literal('"Town".y = "Island".y')
                    ]
                  },
                  attributes: ['type']
                }
              ]
            }),
            Offsets.findAll(),
            (towns, offsets) => {
              towns = towns.map(town => {
                let offset = _.findWhere(offsets, { id: town.Island.type, pos: town.islandno });
                town = town.toJSON();
                
                town = {
                  i: town.id,
                  n: town.name,
                  pt: town.points,
                  pl: {
                    i: town.Player.id,
                    n: town.Player.name,
                    a: town.Player.alliance
                  },
                  x: ( ((town.x * 128) + offset.offsetx) / 128 ),
                  y: ( ((town.y * 128) + offset.offsety) / 128 )
                };
                
                return town;
              });
              
              return resolve(towns);
            } 
          ).catch(reject);
        });
      }
    }
  });

  return Town;
};