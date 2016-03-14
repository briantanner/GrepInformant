'use strict';

module.exports = function (sequelize, DataTypes) {
  var Town = sequelize.define('Town', {
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
    tableName: 'towns'
  });

  return Town;
};