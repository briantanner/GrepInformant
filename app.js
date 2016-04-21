'use strict';

const http = require('http');
const path = require('path');
const getenv = require('getenv');
const morgan = require('morgan');
const express = require('express');
const Router = require('named-routes');
const exphbs  = require('express-handlebars');
const paginate = require('handlebars-paginate');
const utils = require('./lib/utils');
const middleware = require('./lib/middleware');
const redirects = require('./redirects.json');
const logger = require('./lib/logger')({
  consoleLabel: 'web',
  tags: ['web']
});

let app = express(),
    router = new Router(),
    controllerPath = require("path").join(__dirname, "controllers"),
    routes = [],
    hbs;

hbs = exphbs.create({
  extname: '.hbs',
  defaultLayout: 'main',
  partialsDir: 'views/partials/',
  helpers: {
    paginate
  }
});

router.extendExpress(app);
router.registerAppHelpers(app);

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

app.set('port', getenv('PORT', 8080));
app.set('views', path.join(__dirname, 'views'));

app.engine('hbs', hbs.engine);

app.set('view engine', 'hbs');

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

app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'Grepolis Tools https://github.com/briantanner/Grepolis-Tools');
  next();
});

app.use(middleware.worlds);
app.all('/:server*', middleware.server);
app.all('/:server/alliance/:alliance/*?', middleware.alliances);

// app.use(app.router);

// create routes
function createRoutes(routes) {
  for (let o in routes) {
    let route = routes[o];
    app[route.method](route.uri, route.name, route.handler);
  }
}

// load controllers
utils.readdirRecursive(controllerPath, files => {
  files.forEach(file => {
    return createRoutes(require(file));
  });
});

// create 301 redirects
redirects.forEach(redirect => {
  app.get(redirect.route, function (req, res) {
    let url = app.namedRoutes.build(redirect.namedRoute, req.params);
    res.redirect(301, url);
  });
});

// create server
http.createServer(app).listen(app.get('port'), () => {
  logger.info('Express server listening on port %d', app.get('port'));
});
