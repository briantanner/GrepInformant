
/**
 * Module dependencies.
 */

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path');

routes.v1 = require('./routes/v1');
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

// app.get('/', routes.index);
// app.get('/:server/towns/:playerId?', routes.towns);
// app.get('/:server/islands', routes.islands);
// app.get('/:server/players', routes.players);
// app.get('/:server/players/:stat', routes.playerStats);
// app.get('/:server/alliances', routes.alliances);
// app.get('/:server/conquers', routes.conquers);
// app.get('/:server/alliancePlayers/:alliance?', routes.alliancePlayers);
// app.get('/:server/allianceConquers/:alliance', routes.allianceConquers);
// app.get('/:server/allianceLosses/:alliance', routes.allianceLosses);
// app.get('/:server/battleGroupIds', routes.battleGroupIds);
// app.get('/:server/bgConquers', routes.bgConquers);
// app.get('/:server/compare', routes.compare);
// app.get('/:server/sharedIslands/:alliance/:enemy/:ocean?', routes.sharedIslands);

app.get('/v0/:server/map/:playerId?', routes.v1.map);

app.get('/', routes.v1.index);
app.get('/:server/alliances', routes.v1.alliances);
app.get('/:server/players', routes.v1.players);
app.get('/:server/player/:playerId', routes.v1.player);
app.get('/:server/towns/:playerId?', routes.v1.towns);
app.get('/:server/offsets', routes.v1.offsets);
app.get('/:server/islands', routes.v1.islands);
app.get('/:server/map/:id?', routes.v1.mapCanvas);
app.get('/:server/compare', routes.v1.compare);
app.get('/:server/bgConquers', routes.v1.bgConquers);
app.get('/:server/allianceConquers/:alliance', routes.v1.allianceConquers);
app.get('/:server/allianceLosses/:alliance', routes.v1.allianceLosses);

app.get('/', routes.v1.index);
app.get('/v1/:server/alliances', routes.v1.alliances);
app.get('/v1/:server/players', routes.v1.players);
app.get('/v1/:server/player/:playerId', routes.v1.player);
app.get('/v1/:server/towns/:playerId?', routes.v1.towns);
app.get('/v1/:server/offsets', routes.v1.offsets);
app.get('/v1/:server/islands', routes.v1.islands);
app.get('/v1/:server/map/:id?', routes.v1.mapCanvas);
app.get('/v1/:server/compare', routes.v1.compare);
app.get('/v1/:server/bgConquers', routes.v1.bgConquers);
app.get('/v1/:server/allianceConquers/:alliance', routes.v1.allianceConquers);
app.get('/v1/:server/allianceLosses/:alliance', routes.v1.allianceLosses);

app.get('/v1/api/:server/autocomplete/:table', routes.v1.autocomplete);
app.get('/v1/api/:server/map', routes.v1.getMap);
app.post('/v1/api/:server/search', routes.v1.search);


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
