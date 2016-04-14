'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

let basename = path.basename(module.filename),
    db = {};

require('dotenv').config({silent: true});

let dbString = process.env.DATABASE_URL;

let sequelize = new Sequelize(dbString, {
  logging: false,
  dialectOptions: { ssl: true },
  define: { timestamps: false }
});

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
