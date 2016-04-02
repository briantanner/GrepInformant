'use strict';

const _ = require('underscore');
const http = require('http');
const models = require('../models');

// Index Controller
class Index {

  /**
   * Constructor
   * @return {Object} Route configuration
   */
  constructor() {

    // define routes
    return {
      index: {
        method: 'get',
        name: 'index',
        uri: '/',
        handler: this.index.bind(this)
      },
      offsets: {
        method: 'get',
        name: 'offsets',
        uri: '/offsets',
        handler: this.offsets.bind(this)
      },
      home: {
        method: 'get',
        name: 'home',
        uri: '/:server',
        handler: this.home.bind(this)
      }
    };
  }

  /**
   * Index handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  index(req, res) {
    return res.send(200, "Hello! :)");
  }

  /**
   * Home handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  home(req, res) {
    let server = req.params.server;
    return res.render('home');
  }

  /**
   * Offsets handler
   * @param  {Object} req Express request
   * @param  {Object} res Express response
   */
  offsets(req, res) {
    models.Offsets.findAll({})
    .then(offsets => {
      let csvArray = [],
          csvString = '',
          vals = [];

      offsets = offsets.map(o => { return o.toJSON(); });

      csvArray.push(Object.keys(_.first(offsets)).join(','));
      vals = _.map(offsets, o => { return _.values(o).join(','); });

      csvArray = csvArray.concat(vals);
      csvString = csvArray.join("\n");

      res.set('content-type', 'text/csv');
      return res.send(200, csvString);
    });
  }
}

module.exports = new Index();
