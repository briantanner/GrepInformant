'use strict';

module.exports = (sequelize, DataTypes) => {
  let Offsets = sequelize.define('Offsets', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    pos: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    offsetx: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    offsety: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'offsets'
  });

  return Offsets;
};