'use strict';

module.exports = (sequelize, DataTypes) => {
  let PlayerDaily = sequelize.define('PlayerDaily', {
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
    time: {
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
    },
    abp_delta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    dbp_delta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    towns_delta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    points_delta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'player_daily'
  });

  return PlayerDaily;
};