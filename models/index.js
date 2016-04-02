'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

let basename = path.basename(module.filename),
    db = {};

// load .env file if exists
if (fs.existsSync(path.join(process.env.PWD, '.env'))) {
  require('dotenv').load();
}

let dbString = process.env.HEROKU_POSTGRESQL_CHARCOAL_URL;
// let dbString = process.env.HEROKU_POSTGRESQL_TEAL_URL;

let sequelize = new Sequelize(dbString, {
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
