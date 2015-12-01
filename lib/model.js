var _ = require('underscore'),
    pg = require('pg'),
    util = require('util')

require('dotenv').load()

var dbString = process.env.DATABASE_URL

var pgConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: true
}

var Model = {}

Model.query = function (query, callback) {

  pg.connect(pgConfig, function (err, client, done) {
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

Model.alliances = function (options, callback) {
  var query = options.query || "select * from alliances"

  if (options.ids) {
    query += (_.isArray(options.ids)) ? 
      util.format(" where id in (%s)", options.ids.join(', ')) : 
      util.format(" where id = %s", "" + options.ids)
  }

  query += " order by rank asc"

  this.query(query, callback)
}

Model.conquers = function (options, callback) {
  var select = [ "c.time", "c.town", "t.name as townname", "t.points", "t.x", "t.y", "c.newplayer as newplayerid", 
                 "newplayer.name as newplayer", "c.oldplayer as oldplayerid", "oldplayer.name as oldplayer", 
                 "c.newally as newallyid", "newally.name as newally", "c.oldally as oldallyid", "oldally.name as oldally" ],
      joins = [ "left join players newplayer on newplayer.id = c.newplayer", 
                "left join players oldplayer on oldplayer.id = c.oldplayer",
                "left join alliances newally on newally.id = c.newally", 
                "left join alliances oldally on oldally.id = c.oldally",
                "join towns t on c.town = t.id" ],
      query = options.query || util.format("select %s from conquers c %s", select.join(", "), joins.join(" "))

  if (options.alliances) {
    query += (_.isArray(options.alliances)) ?
      util.format(" where newally = %s OR oldally = %s", "" + options.alliances) :
      util.format(" where newally in (%s) or oldally in (%s)", options.alliances.join(', '))
  }

  if (options.players) {
    query += (_.isArray(options.players)) ?
      util.format(" where newplayer = %s OR oldplayer = %s", "" + options.players) :
      util.format(" where newplayer in (%s) or oldplayer in (%s)", options.players.join(', '))
  }

  if (options.where)
    query += " where " + options.where

  query += " order by time desc"

  this.query(query, function (err, result) {
    if (err) { return callback(err) }

    result = _.map(result, function (o) {
      o.time = new Date(o.time*1000).toUTCString()
      o.newplayer = (o.newplayer && o.newplayer.length) ? o.newplayer : 'Unknown'
      o.oldplayer = (o.oldplayer && o.oldplayer.length) ? o.oldplayer : 'Unknown'
      o.newally = (o.newallyid) ? (o.newally && o.newally.length) ? o.newally : 'Unknown' : 'No Alliance'
      o.oldally = (o.oldallyid) ? (o.oldally && o.oldally.length) ? o.oldally : 'Unknown' : 'No Alliance'

      return o
    })

    return callback(null, result)
  })
}

Model.towns = function (options, callback) {
  var query = "select * from towns"

  if (options.id)
    query += util.format(" where player = %s", options.id)

  this.query(query, callback)
}

Model.islands = function (options, callback) {
  var query = "select * from islands"
  console.log((!options.where && (!options.x && !options.y)));

  if (!options.where && (!options.x && !options.y))
    return callback('Missing required arguments.')

  this.query(query, callback)
}

Model.players = function (options, callback) {
  var query = "select * from players"

  if (options.where)
    query += " where " + options.where

  if (options.ids) {
    query += (_.isArray(options.ids)) ? 
      util.format(" where id in (%s)", options.ids.join(', ')) : 
      util.format(" where id = %s", "" + options.ids)
  }

  query += " order by rank asc"

  this.query(query, function (err, result) {
    if (err) { return callback(err) }
    return callback(null, result)
  })
}

Model.playerUpdates = function (options, callback) {
  var query = "select * from player_updates"

  if (!options.where)
    return callback('Where clause required for playerUpdates method')

  query += " where " + options.where
  query += (options.sort) ? util.format(" order by %s", options.sort) : " order by time desc"
  
  if (options.limit)
    query += util.format(" limit %d", options.limit)

  this.query(query, function (err, result) {
    if (err) { return callback(err) }
    return callback(null, result)
  })
}

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