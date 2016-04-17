'use strict';

module.exports = (sequelize, DataTypes) => {
  let Island = sequelize.define('Island', {
    server: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
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
    type: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    availablespots: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    plus: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    minus: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
  }, {
    tableName: 'islands'
  });

  return Island;
};