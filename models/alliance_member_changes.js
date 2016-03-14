'use strict';

module.exports = function (sequelize, DataTypes) {
  var AllianceMemberChanges = sequelize.define('AllianceMemberChanges', {
    server: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    player: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    time: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    player_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    old_alliance: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    new_alliance: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    old_alliance_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    new_alliance_name: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'alliance_member_changes'
  });

  return AllianceMemberChanges;
};