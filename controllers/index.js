'use strict';

const http = require('http');

// Index Controller
class Index {

  constructor() {

    // define routes
    return {
      index: {
        method: 'get',
        name: 'index',
        uri: '/',
        handler: this.index.bind(this)
      },
      test: {
        method: 'get',
        name: 'test',
        uri: '/test',
        handler: this.test.bind(this)
      },
      home: {
        method: 'get',
        name: 'home',
        uri: '/:server',
        handler: this.home.bind(this)
      },
      quad: {
        method: 'get',
        name: 'quad',
        uri: '/quad/:quad/:ocean',
        handler: this.quad.bind(this)
      }
    };
  }

  index(req, res) {
    return res.send(200, "Hello! :)");
  }

  home(req, res) {
    let server = req.params.server;
    return res.render('home');
  }

  test(req, res) {
    http.get('http://localhost:8080/', response => {
      let data = { body: '' };

      data.headers = response.headers;

      response.on('data', d => {
        data.body += d;
      });

      response.on('end', () => {
        return res.send(200, data);
      });
    });
  }

  quad(req, res) {
    let ocean = req.params.ocean,
        quad = req.params.quad,
        x = parseInt(ocean.split('')[0],10),
        y = parseInt(ocean.split('')[1],10),
        w = 33,
        h = 33,
        quads = {
          'nw': [0,0],
          'nc': [33,0],
          'ne': [67,0],
          'cw': [0,33],
          'cc': [33,33],
          'ce': [67,33],
          'sw': [0,67],
          'sc': [33,67],
          'se': [67,67]
        },
        bounds;

    quad = quads[quad];
    bounds = {
      x1: (x*100)+quad[0],
      y1: (y*100)+quad[1],
      x2: (x*100)+quad[0]+w,
      y2: (y*100)+quad[1]+h
    };

    return res.send(200, bounds);
  }
}

module.exports = new Index();
