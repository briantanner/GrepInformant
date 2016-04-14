'use strict';

const util = require('util');

let models = require('../../models'),
    sequelize = models.sequelize,
    logger = require('../../lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    });

class Index {

  constructor() {
    return {
      autocomplete: {
        method: 'get',
        name: 'api.autocomplete',
        uri: '/api/v1/:server/autocomplete/:table',
        handler: this.autocomplete.bind(this)
      },
      intel: {
        method: 'post',
        name: 'api.town.intel',
        uri: '/api/v1/:server/town/:town/intel',
        handler: this.intel.bind(this)
      }
    };
  }

  insertIntel(server, town, intel) {
    return new Promise((resolve, reject) => {
      let time = Math.round(new Date() / 1000);

      models.TownIntel.build({
        server: server,
        id: town,
        time: time,
        intel: intel
      })
      .save()
      .then(() => {
        return resolve();
      })
      .catch(reject);
    });
  }

  updateIntel(intel, value) {
    return new Promise((resolve, reject) => {
      let time = Math.round(new Date() / 1000);

      intel.updateAttributes({
        time: time,
        intel: value
      })
      .then(() => {
        return resolve();
      })
      .catch(reject);
    });
  }

  autocomplete(req, res) {
    let server = req.params.server,
        table = req.params.table || 'players',
        input = req.query.input.replace(/'/g, "''") || null;

    if (!input || input.length < 3) {
      return res.send(200, null);
    }

    console.log(input);

    models.Player.findAll({
      where: {
        $and: [
          { server: server, deleted: false },
          sequelize.literal(util.format("lower(name) like '%s%%'", input.toLowerCase()))
        ]
      },
      // where: sequelize.fn('lower', sequelize.col('name'), input.toLowerCase()),
      attributes: ['id', 'name']
    })
    .then(players => {
      players = players.map(o => { return o.toJSON(); });
      return res.send(200, players);
    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }

  intel(req, res) {
    var server = req.params.server,
        town = req.params.town,
        intelStr = req.body.intel || null;

    models.TownIntel.find({
      where: { server: server, id: town }
    })
    .then(intel => {

      if (!intel) {
        return this.insertIntel(server, town, intelStr).then(() => {
          return res.send(200, 'ok');
        }).catch(err => {
          logger.error(err);
          return res.send(500, err);
        });
      }

      if (!intelStr || !intelStr.length) {
        
        intel.destroy().then(o => {
          return res.send(200, o);
        })
        .catch(err => {
          logger.error(err);
          return res.send(500, err);
        });

      } else {

        this.updateIntel(intel, intelStr).then(() => {
          return res.send(200, 'ok');
        }).catch(err => {
          logger.error(err);
          return res.send(500, err);
        });

      }


    })
    .catch(err => {
      logger.error(err);
      return res.send(500, err);
    });
  }
}

module.exports = new Index();
