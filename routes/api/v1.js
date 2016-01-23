var _ = require('underscore'),
  util = require('util'),
  // urlencode = require('urlencode'),
  async = require('async'),
  crypto = require('crypto'),
  moment = require('moment'),
  // accounting = require('accounting'),
  Data = require('../../lib/model'),
  // config = require('../config.json'),
  defaults = { title: 'Grepolis Tools' }

exports.autocomplete = function (req, res) {
  var server = req.params.server,
      table = req.params.table || 'players',
      input = req.query.input.replace(/'/g, "''") || null

  if (!input || input.length < 3)
    return res.send(500, 'Input string must be at least 3 characters.')

  var query = util.format("select * from %s where server = '%s' and lower(name) like lower('%s%%') order by name asc limit 10", table, server, input)
  Data.query(query, function (err, result) {
    if (err) return res.send(500, err)
    return res.send(200, result)
  })
}

exports.search = function (req, res) {
  var server = req.params.server,
      ally = req.body.ally,
      player = req.body.player
    
  if (!ally.length && !player.length) 
    return res.send(500, 'Nothing to search')

  var query = "insert into searches (id, time, options) values ('%s', %d, '%s')",
      sha256 = crypto.createHash("sha1", "utf8"),
      time = Math.floor( new Date() / 1000),
      id = "",
      hashKey = time + ally.concat(player).join(",")

  sha256.update(hashKey)
  id = sha256.digest('hex')

  query = util.format(query, id, time, JSON.stringify(req.body).replace(/'/g, "''"))

  Data.query(query, function (err, result) {
    if (err) return res.send(500, err)
    return res.send(200, { id: id })
  })
}

exports.getMapSettings = function (req, res) {
  var server = req.params.server,
      id = req.query.id || null

  Data.searches({ id: id }, function (err, result) {
    if (err) return callback(err)
    var row = result.shift()
    row.options = JSON.parse(row.options)
    return res.send(null, row)
  })
}

exports.getMap = function (req, res) {
  var server = req.params.server,
      id = req.query.id || null,
      allyId = req.query.ally,
      playerId = req.query.player

  async.waterfall([

    // get alliances
    function (callback) {
      Data.alliances(server, {}, function (err, result) {
        if (err) return callback(err)
        return callback(null, { alliances: result })
      })
    },

    // get search data
    function (data, callback) {
      if (!id) return callback(null, data)

      Data.searches({ id: id }, function (err, result) {
        if (err) return callback(err)
        var row = result.shift()
        row.options = JSON.parse(row.options)
        return callback(null, row)
      })
    },

    // update last_used
    function (data, callback) {
      if (!data.id) return callback(null, data)
      
      var time = Math.floor( new Date() / 1000),
          query = util.format("update searches set last_used = '%s' where id = '%s'", time, data.id)

      Data.query(query, function (err) {
        if (err) return callback(err)
        return callback(null, data)
      })
    },

    // map id/name to search options
    function (data, callback) {
      if (!id) return callback(null, data)
      if (!data.options.player || data.options.player.length === 0)
        return callback(null, data)

      var whereString = util.format("id in (%s)", data.options.player.join(', '))

      Data.players(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        var players = _.indexBy(result, 'id')

        data.options.player = _.map(data.options.player, function (id) {
          return { id: id, name: players[id].name }
        })

        return callback(null, data)
      })
    },

    // get towns from search params
    function (data, callback) {
      if (!id) return callback(null, data)

      var ally = data.options.ally,
          player = _.pluck(data.options.player, 'id'),
          allyColor = data.options.allycolor,
          playerColor = data.options.playercolor

      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          query = util.format("select %s from towns t %s where t.server = '%s'", select.join(', '), joins.join(' '), server)

      if (ally.length) {
        query += " and ( p.alliance in (" + ally.join(", ") + ")"
      }
      if (player.length) {
        query += (ally.length) ? " or" : " and ( "
        query += " t.player in (" + player.join(", ") + ")"
      }

      query += " )"

      Data.query(query, function (err, result) {
        if (err) return callback(err)

        data.towns = result
        
        if (allyColor.length || playerColor.length) {
          var allyColors = {},
              playerColors = {}
          
          _.each(allyColor, function (color, i) { allyColors[ally[i]] = color })
          _.each(playerColor, function (color, i) { playerColors[player[i]] = color })

          data.towns = _.map(data.towns, function (o) {
            o.color = ''

            if (!allyColors[o.alliance] && !playerColors[o.playerid]) { return o }
            if (allyColors[o.alliance]) { o.color = allyColors[o.alliance] }
            if (playerColors[o.playerid]) { o.color = playerColors[o.playerid] }

            return o
          })
        }

        return callback(null, data)
      })
    },

    // get players/alliances
    function (data, callback) {
      if (id) { return callback(null, data) }
      if (!playerId && !allyId) { return callback(null, data) }

      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.player = p.id", "inner join islands i on t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          query = util.format("select %s from towns t %s where t.server = '%s'", select.join(', '), joins.join(' '), server)
      
      if (playerId) query += util.format(" and t.player = '%s'", playerId)
      if (allyId) query += util.format(" and p.alliance = %s", allyId)
      
      Data.query(query, function (err, result) {
        if (err) return callback(err)
        data.towns = result
        return callback(null, data)
      })
    },

    // get ghosts
    function (data, callback) {
      var select = [ "t.id", "t.name", "t.points", "t.x", "t.y", "t.islandNo", "t.player as playerid", 
                     "p.name as player", "p.alliance", "i.type", "o.offsetx", "o.offsety" ],
          joins = [ "left join players p on t.server = p.server and t.player = p.id",
                    "inner join islands i on t.server = i.server and t.x = i.x and t.y = i.y",
                    "inner join offsets o on i.type = o.id and t.islandNo = o.pos" ],
          where = "t.player = 0 and t.points > 1200",
          query = util.format("select %s from towns t %s where t.server = '%s' and %s", select.join(', '), joins.join(' '), server, where)

      // query = util.format("select %s from towns t %s where t.server = '%s'", select.join(', '), joins.join(' '), server)
      // console.log(query)

      Data.query(query, function (err, result) {
        if (err) return callback(err)
        data.towns = (data.towns && data.towns.length) ? data.towns.concat(result) : result
        return callback(null, data)
      })
    }

  ], function (err, data) {
    if (err) return res.send(500, err)

    data.towns = _.map(data.towns, function (o) {
      var town = {};

      // Island_X = x-coordinate from islands.txt * 128
      // Island_Y = y-coordinate from islands.txt * 128 if x is even
      // Island_Y = 64 + y-coordinate from islands.txt * 128 if x is odd
      town.id = o.id
      town.name = o.name
      town.points = o.points
      town.alliance = o.alliance
      town.player = o.player || 'ghost'
      town.exactX = ( ((o.x * 128) + o.offsetx) / 128 )
      town.exactY = ( ((o.y * 128) + o.offsety) / 128 ) // : ( (((64 + o.y) * 128) + o.offsety) / 128 )
      town.color = o.color
      town.island = o.islandno

      return town
    })

    data.server = server

    return res.send(200, data)
  })
}

// For debug purposes
exports.getLastHour = function (req, res) {
  var timestamp = moment().subtract(1, 'hours').format('X')
  return res.send(200, timestamp)
}

exports.getLastTime = function (req, res) {
  var count = req.query.count,
      metric = req.query.metric,
      timestamp = moment().subtract(count, metric).format('X')
  return res.send(200, timestamp)
}

exports.playerUpdates = function (req, res) {
  if (!req.query || !req.query.time)
    return res.send(500, "Time parameter required.")

  var server = req.params.server,
      alliances = req.query.alliances || null,
      whereString = util.format("time > %s", req.query.time)

  if (alliances)
    whereString += util.format(" AND alliance IN (%s)", alliances)

  async.waterfall([

    function (callback) {
      Data.playerUpdates(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        return callback(null, result)
      })
    }

    ], function (err, updates) {
      if (err) return res.send(500, err)

      var data = {
        count: updates.length,
        updates: updates
      }

      return res.send(200, data)
    })
}

exports.conquers = function (req, res) {
  if (!req.query || !req.query.time)
    return res.send(500, "Time parameter required.")

  var server = req.params.server,
      whereString = util.format("time > %s", req.query.time)

  Data.conquers(server, { where: whereString }, function (err, updates) {
    if (err) return res.send(500, err)

    var data = {
      count: updates.length,
      updates: updates
    }

    return res.send(200, data)
  })
}