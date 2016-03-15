'use strict';

module.exports = (sequelize, DataTypes) => {
  let Search = sequelize.define('Search', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    time: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    options: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    last_used: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'searches'
  });

  return Search;
};