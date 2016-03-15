'use strict';

module.exports = (sequelize, DataTypes) => {
  let Worlds = sequelize.define('Worlds', {
    server: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    created: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    updated: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    world_speed: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    unit_speed: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'worlds'
  });

  return Worlds;
};