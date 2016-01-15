/**
 * Module dependencies.
 */

var express = require('express'),
  	http = require('http'),
  	path = require('path'),
    morgan = require('morgan'),
    web = require('./routes/v1'),
    api = require('./routes/api/v1'),
    Data = require('./lib/model'),
    middleware = require('./lib/middleware')

var app = express()

// all environments
app.set('port', process.env.PORT || 8080)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')
app.use(express.favicon())
// app.use(express.logger('dev'))
app.use(morgan('short'))
app.use(express.json())
app.use(express.urlencoded())
app.use(express.methodOverride())
app.use(express.static(path.join(__dirname, 'public')))

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler())
}

app.locals({
  site: {
    title: "Grepolis Informant"
  },
  author: {
    name: "Noob Lance (Lance The Strange)",
    email: "lance@grepinformant.com"
  }
})

app.use(middleware.all)
app.all('/:server/*', middleware.server)

app.use(app.router)

app.get('/', web.index)
app.get('/:server/alliances', web.alliances)
app.get('/:server/alliance/:alliance', web.alliance)
app.get('/:server/players', web.players)
app.get('/:server/player/:playerId', web.player)
app.get('/:server/towns/:playerId?', web.towns)
app.get('/:server/offsets', web.offsets)
app.get('/:server/islands', web.islands)
app.get('/:server/map/:id?', web.mapCanvas)
app.get('/:server/compare', web.compare)
app.get('/:server/bgConquers', web.bgConquers)
app.get('/:server/allianceConquers/:alliance?', web.allianceConquers)
app.get('/:server/allianceLosses/:alliance', web.allianceLosses)

// app.get('/', web.index)
// app.get('/v1/:server/alliances', web.alliances)
// app.get('/v1/:server/players', web.players)
// app.get('/v1/:server/player/:playerId', web.player)
// app.get('/v1/:server/towns/:playerId?', web.towns)
// app.get('/v1/:server/offsets', web.offsets)
// app.get('/v1/:server/islands', web.islands)
// app.get('/v1/:server/map/:id?', web.mapCanvas)
// app.get('/v1/:server/compare', web.compare)
// app.get('/v1/:server/bgConquers', web.bgConquers)
// app.get('/v1/:server/allianceConquers/:alliance?', web.allianceConquers)
// app.get('/v1/:server/allianceLosses/:alliance', web.allianceLosses)
// app.get('/v1/:server/farmableIslands/:ocean', web.farmableIslands)

app.get('/api/v1/lastHour', api.getLastHour)
app.get('/api/v1/:server/playerUpdates', api.playerUpdates)
app.get('/api/v1/:server/conquers', api.conquers)
app.get('/v1/api/:server/autocomplete/:table', api.autocomplete)
app.get('/v1/api/:server/map', api.getMap)
app.post('/v1/api/:server/search', api.search)
app.get('/v1/api/:server/map/settings', api.getMapSettings)


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))
})
