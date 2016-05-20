'use strict';

const fs = require('fs');
const path = require('path');
const getenv = require('getenv');
const Sequelize = require('sequelize');

let basename = path.basename(module.filename),
    db = {};

require('dotenv').config({silent: true, path: path.join(__dirname, '..', '.env') });

let dbString = getenv('DATABASE_URL'),
    options = {
      logging: getenv.bool('DEBUG_LOGGING', false),
      dialectOptions: { ssl: true },
      define: { timestamps: false }
    },
    sequelize;

sequelize = new Sequelize(dbString, options);

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    let model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
