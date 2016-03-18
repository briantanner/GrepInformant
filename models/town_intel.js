'use strict';

module.exports = (sequelize, DataTypes) => {
  let TownIntel = sequelize.define('TownIntel', {
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
      allowNull: false
    },
    intel: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'town_intel'
  });

  return TownIntel;
};