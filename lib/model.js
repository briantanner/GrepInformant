var _ = require('underscore'),
    pg = require('pg').native,
    util = require('util'),
    moment = require('moment')

require('dotenv').load()

var dbString = process.env.HEROKU_POSTGRESQL_CHARCOAL_URL

var Model = {}

Model.query = function (query, callback) {

  pg.connect(dbString, function (err, client, done) {
    var handleError = function (err, callback) {
      if (!err) return false

      if (client) {
        done(client)
      }
      console.error(err)
      return callback(err)
    }

    if (handleError(err, callback)) return

    client.query({ text: query }, function (err, result) {
      if (err) { return callback(err) }
      
      done()
      pg.end()
      
      if (!result.rows)
        return callback(null, result)

      return callback(null, result.rows)
    })
  })
}

Model.worlds = function (callback) {
  var query = "select * from worlds order by server desc"
  this.query(query, callback)
}

Model.alliances = function (server, options, callback) {
  var query = options.query || util.format("select * from alliances where server = '%s' and deleted = false", server)

  if (options.ids) {
    query += (_.isArray(options.ids)) ? 
      util.format(" and id in (%s)", options.ids.join(', ')) : 
      util.format(" and id = %s", "" + options.ids)
  }

  query += " order by rank asc"

  this.query(query, callback)
}

Model.conquers = function (server, options, callback) {
  var select = [ "c.time", "c.town", "t.name as townname", "t.points", "t.x", "t.y", "c.newplayer as newplayerid", 
                 "newplayer.name as newplayer", "c.oldplayer as oldplayerid", "oldplayer.name as oldplayer", 
                 "c.newally as newallyid", "newally.name as newally", "c.oldally as oldallyid", "oldally.name as oldally" ],
      joins = [ "left join players newplayer on newplayer.id = c.newplayer and newplayer.server = c.server", 
                "left join players oldplayer on oldplayer.id = c.oldplayer and oldplayer.server = c.server",
                "left join alliances newally on newally.id = c.newally and newally.server = c.server", 
                "left join alliances oldally on oldally.id = c.oldally and oldally.server = c.server",
                "join towns t on c.town = t.id and c.server = t.server" ],
      query = options.query || util.format("select %s from conquers c %s where c.server = '%s'", select.join(", "), joins.join(" "), server)

  if (options.alliances) {
    query += (_.isArray(options.alliances)) ?
      util.format(" and ( newally = %s OR oldally = %s )", "" + options.alliances) :
      util.format(" and ( newally in (%s) or oldally in (%s) )", options.alliances.join(', '))
  }

  if (options.players) {
    query += (_.isArray(options.players)) ?
      util.format(" and ( newplayer = %s OR oldplayer = %s )", "" + options.players) :
      util.format(" and ( newplayer in (%s) or oldplayer in (%s) )", options.players.join(', '))
  }

  if (options.where)
    query += " and (" + options.where + ")"

  query += " order by time desc"

  this.query(query, function (err, result) {
    if (err) { return callback(err) }

    result = _.map(result, function (o) {
      var offset = -5
      o.time = moment.unix(o.time).format("Y-MM-DD HH:mm:ss")
      // o.time = new Date( new Date(o.time*1000) + (offset * 3600) * 1000).toUTCString()
      // o.time = new Date(o.time*1000).toUTCString()
      o.newplayer = (o.newplayer && o.newplayer.length) ? o.newplayer : 'Unknown'
      o.oldplayer = (o.oldplayer && o.oldplayer.length) ? o.oldplayer : 'Unknown'
      o.newally = (o.newallyid) ? (o.newally && o.newally.length) ? o.newally : 'Unknown' : 'No Alliance'
      o.oldally = (o.oldallyid) ? (o.oldally && o.oldally.length) ? o.oldally : 'Unknown' : 'No Alliance'

      return o
    })

    return callback(null, result)
  })
}

Model.towns = function (server, options, callback) {
  var query = util.format("select * from towns where server = '%s'", server)

  if (options.id)
    query += util.format(" and player = %s", options.id)

  this.query(query, callback)
}

Model.islands = function (server, options, callback) {
  var query = util.format("select * from islands where server = '%s'", server)
  console.log((!options.where && (!options.x && !options.y)));

  if (!options.where && (!options.x && !options.y))
    return callback('Missing required arguments.')

  query += util.format(" and (%s)", options.where)

  this.query(query, callback)
}

Model.players = function (server, options, callback) {
  var query = util.format("select * from players where server = '%s'", server)

  if (options.where)
    query += " and (" + options.where + ")"

  if (options.ids) {
    query += (_.isArray(options.ids)) ? 
      util.format(" and id in (%s)", options.ids.join(', ')) : 
      util.format(" and id = %s", "" + options.ids)
  }

  query += " order by rank asc"

  this.query(query, function (err, result) {
    if (err) { return callback(err) }
    return callback(null, result)
  })
}

Model.playerUpdates = function (server, options, callback) {
  var query = util.format("select * from player_updates where server = '%s'", server)

  if (!options.where)
    return callback('Where clause required for playerUpdates method')

  query += " and (" + options.where + ")"
  query += (options.sort) ? util.format(" order by %s", options.sort) : " order by time desc"
  
  if (options.limit)
    query += util.format(" limit %d", options.limit)

  this.query(query, function (err, result) {
    if (err) { return callback(err) }
    return callback(null, result)
  })
}

// Model.playerUpdatesByIds = function (server, options, callback) {
//   var query = util.format("select * from player_updates where server = '%s'", server)

//   if (!options.where)
//     return callback('Where clause required for playerUpdates method')

//   query += " and (" + options.where + ")"
//   query += (options.sort) ? util.format(" order by %s", options.sort) : " order by time desc"
  
//   if (options.limit)
//     query += util.format(" limit %d", options.limit)

//   this.query(query, function (err, result) {
//     if (err) { return callback(err) }
//     return callback(null, result)
//   })
// }

Model.searches = function (options, callback) {
  var query = "select * from searches"

  if (options.id)
    query += util.format(" where id = '%s'", options.id)

  this.query(query, callback)
}

Model.offsets = function (options, callback) {
  var query = "select * from offsets"

  this.query(query, callback)
}

module.exports = Model;