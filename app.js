
/**
 * Module dependencies.
 */

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path');

// require('dotenv').load();

var app = express();

// all environments
app.set('port', process.env.PORT || 8080);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/:server/towns', routes.towns);
app.get('/:server/players', routes.players);
app.get('/:server/players/:stat', routes.playerStats);
app.get('/:server/alliances', routes.alliances);
app.get('/:server/conquers', routes.conquers);
app.get('/:server/alliancePlayers/:alliance?', routes.alliancePlayers);
app.get('/:server/allianceConquers/:alliance', routes.allianceConquers);
app.get('/:server/battleGroupIds', routes.battleGroupIds);
app.get('/:server/bgConquers', routes.bgConquers);
app.get('/:server/compare', routes.compare);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
