'use strict';

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
      home: {
        method: 'get',
        name: 'home',
        uri: '/:server',
        handler: this.home.bind(this)
      }
    };
  }

  index(req, res) {
    return res.send(200, "Hello! :)");
  }

  home(req, res) {
    let server = req.params.server;
    return res.render('world');
  }
}

module.exports = new Index();
