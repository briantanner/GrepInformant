'use strict';

module.exports = function (sequelize, DataTypes) {
  var Player = sequelize.define('Player', {
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
      associate: function (models) {
        Player.hasOne(models.Alliance, { foreignKey: 'server', as: 'Alliance' });
        Player.hasMany(models.Town, { foreignKey: 'server', as: 'Towns' });
      }
    }
  });

  return Player;
};