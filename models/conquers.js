'use strict';

module.exports = function (sequelize, DataTypes) {
  var Conquers = sequelize.define('Conquers', {
    id: {
      type: DataTypes.BIGINT,
      unique: true,
      allowNull: false
    },
    server: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    time: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    town: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    newplayer: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    oldplayer: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    newally: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    oldally: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'conquers',
    classMethods: {
      associate: function (models) {
        Conquers.hasOne(models.Player, { foreignKey: 'server', as: 'newPlayerObj' });
        Conquers.hasOne(models.Player, { foreignKey: 'server', as: 'oldPlayerObj' });
        Conquers.hasOne(models.Alliance, { foreignKey: 'server', as: 'newAllyObj' });
        Conquers.hasOne(models.Alliance, { foreignKey: 'server', as: 'oldAllyObj' });
        Conquers.hasOne(models.Town, { foreignKey: 'server', as: 'townObj' });
      }
    }
  });
  return Conquers;
};