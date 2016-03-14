'use strict';

const http = require('http');
const path = require('path');
const morgan = require('morgan');
const express = require('express');

let app = express(),
    utils = require('./lib/utils'),
    middleware = require('./lib/middleware'),
    logger = require('./lib/logger')({
      consoleLabel: 'web',
      tags: ['web']
    }),
    controllerPath = require("path").join(__dirname, "controllers"),
    routes = [];

// create write stream for morgan logs to winston
logger.stream = {
  write: (message, encoding) => {
    // handle trailing newlines and multi-line logs
    let messages = message.split("\n");

    messages.forEach(line => {
      if (line.length) {
        logger.info(line);
      }
    });
  }
};

app.set('port', process.env.PORT || 8080);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());

// use morgan for better access logs
app.use(morgan('short', { "stream": logger.stream }));

app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// set template data
app.locals({
  site: {
    title: "Grepolis Informant"
  },
  author: {
    name: "Noob Lance (Lance The Strange)",
    email: "lance@grepinformant.com"
  }
});

app.use(middleware.worlds);
app.all('/:server/*', middleware.server);

app.use(app.router);

// create routes
function createRoutes(routes) {
  for (let o in routes) {
    let route = routes[o];
    app[route.method](route.uri, route.handler);
  }
}

// load controllers
utils.readdirRecursive(controllerPath)
  .then(files => {
    files.forEach(file => {
      if (file.indexOf('v1') !== -1) {
        return;
      }
      return createRoutes(require(file));
    });
  })
  .catch(err => {
    logger.error(err);
  });

// create server
http.createServer(app).listen(app.get('port'), () => {
  logger.info('Express server listening on port %d', app.get('port'));
});
