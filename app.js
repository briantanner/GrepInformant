/**
 * Module dependencies.
 */

var express = require('express'),
  	http = require('http'),
  	path = require('path'),
    routes = require('./routes/v1')

var app = express()

// all environments
app.set('port', process.env.PORT || 8080)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.use(express.favicon())
app.use(express.logger('dev'))
app.use(express.json())
app.use(express.urlencoded())
app.use(express.methodOverride())
app.use(app.router)
app.use(express.static(path.join(__dirname, 'public')))

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler())
}

app.get('/', routes.index)
app.get('/:server/alliances', routes.alliances)
app.get('/:server/players', routes.players)
app.get('/:server/player/:playerId', routes.player)
app.get('/:server/towns/:playerId?', routes.towns)
app.get('/:server/offsets', routes.offsets)
app.get('/:server/islands', routes.islands)
app.get('/:server/map/:id?', routes.mapCanvas)
app.get('/:server/compare', routes.compare)
app.get('/:server/bgConquers', routes.bgConquers)
app.get('/:server/allianceConquers/:alliance', routes.allianceConquers)
app.get('/:server/allianceLosses/:alliance', routes.allianceLosses)

app.get('/', routes.index)
app.get('/v1/:server/alliances', routes.alliances)
app.get('/v1/:server/players', routes.players)
app.get('/v1/:server/player/:playerId', routes.player)
app.get('/v1/:server/towns/:playerId?', routes.towns)
app.get('/v1/:server/offsets', routes.offsets)
app.get('/v1/:server/islands', routes.islands)
app.get('/v1/:server/map/:id?', routes.mapCanvas)
app.get('/v1/:server/compare', routes.compare)
app.get('/v1/:server/bgConquers', routes.bgConquers)
app.get('/v1/:server/allianceConquers/:alliance', routes.allianceConquers)
app.get('/v1/:server/allianceLosses/:alliance', routes.allianceLosses)

app.get('/v1/api/:server/autocomplete/:table', routes.autocomplete)
app.get('/v1/api/:server/map', routes.getMap)
app.post('/v1/api/:server/search', routes.search)


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))
})
