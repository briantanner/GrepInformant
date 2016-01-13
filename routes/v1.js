var _ = require('underscore'),
  util = require('util'),
  urlencode = require('urlencode'),
  async = require('async'),
  crypto = require('crypto'),
  moment = require('moment'),
  accounting = require('accounting'),
  Data = require('../lib/model'),
  config = require('../config.json'),
  defaults = { title: 'Grepolis Tools' }

exports.index = function (req, res) {
  // need a home page
  return res.send(200, "Hello! :)")
}

exports.towns = function (req, res) {
  var server = req.params.server,
      playerId = req.params.playerId || null

  Data.towns(server, { id: playerId }, function (err, result) {
    if (err) return res.send(500, err)
    return res.send(200, result)
  })
}

exports.islands = function (req, res) {
  var x = req.params.x || null,
      y = req.params.y || null

  Data.islands(server, { x: x, y: y}, function (err, result) {
    if (err) return res.send(500, err)
    return res.send(200, result)
  })
}

exports.farmableIslands = function (req, res) {
  var x = req.params.ocean.split('').shift() * 100,
      y = req.params.ocean.split('').pop() * 100,
      server = req.params.server,
      where = [
        util.format("(x > %d and x < %d)", x, x+99),
        util.format("(y > %d and y < %d)", y, y+99),
        "( (type >= 1 and type <= 10) or (type >= 37 and type <= 46) )",
        "availablespots > 0"
      ],
      whereString = where.join(' and ') + " order by availablespots desc"

  Data.islands(server, { where: whereString }, function (err, result) {
    if (err) return res.send(500, err)
    return res.render('farmable', _.extend(defaults, { islands: result }))
  })
}

exports.alliances = function (req, res) {
  var server = req.params.server

  Data.alliances(server, {}, function (err, data) {
    if (err) return res.send(500, err)
    return res.send(200, data)
  })
}

exports.alliance = function (req, res) {
  var server = req.params.server

  async.waterfall([

    function (callback) {
      var allyId = urlencode.decode(req.params.alliance).replace(/\+/g, ' ').replace(/\'/g, "''"),
          column = (!isNaN(allyId)) ? 'id' : 'name',
          whereString = util.format("%s = '%s'", column, allyId)

      Data.alliances(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        return callback(null, result[0])
      })
    },

    function (alliance, callback) {
      var whereString = util.format('alliance = %s', alliance.id)

      Data.players(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        alliance.memberCount = alliance.members
        alliance.members = result
        return callback(null, alliance)
      })
    },

    function (alliance, callback) {

    }

  ], function (err, alliance) {
    if (err) return res.send(500, err)
    return res.send(200, alliance)
  })
}

exports.allianceConquers = function (req, res) {

  var server = req.params.server,
      alliance = req.params.alliance,
      start = req.query.start || null,
      end = req.query.end || null,
      hideInternals = req.query.hideinternals || null

  async.waterfall([

    function (callback) {
      Data.alliances(server, {}, function (err, result) {
        if (err) return callback(err)
        return callback(null, { alliances: result })
      })
    },

    function (data, callback) {
      var startArray = (start) ? start.split('-') : null,
          endArray   = (end)   ? end.split('-') : null,
          startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
          endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null,
          whereArray = [],
          whereString = ""

      if (alliance)
        whereArray.push(util.format("newally = %s", alliance))

      if (hideInternals)
        whereArray.push(util.format("oldally != %s", alliance))

      if (startDate)
        whereArray.push(util.format("time > %s", startDate))
      if (endDate)
        whereArray.push(util.format("time < %s", endDate))

      if (whereArray.length)
        whereString = whereArray.join(" and ")

      Data.conquers(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        return callback(null, _.extend(data, { conquers: result }))
      })
    },

    function (data, callback) {
      data.conquers = _.map(data.conquers, function (o) {
        var x = Math.floor(o.x/100),
            y = Math.floor(o.y/100)
        o.ocean = util.format("%d%d", x, y)
        return o
      })
      return callback(null, data)
    },

  ], function (err, data) {
    if (err) return res.send(500, err)

    data.title = "Alliance Conquers"
    data.ally = _.sample(data.conquers).newally
    data.server = server

    return res.render('allyconquers', _.extend(defaults, data))
  })
}

exports.allianceLosses = function (req, res) {
  var server = req.params.server,
      alliance = req.params.alliance,
      start = req.query.start || null,
      end = req.query.end || null

  async.waterfall([

    function (callback) {
      Data.alliances(server, {}, function (err, result) {
        if (err) return callback(err)
        return callback(null, { alliances: result })
      })
    },

    function (data, callback) {
      var whereString = util.format("oldally = %s and newally != %s and newally is not null", alliance, alliance),
          startArray = (start) ? start.split('-') : null,
          endArray   = (end)   ? end.split('-') : null,
          startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
          endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null

      if (startDate)
        whereString += util.format(" and time > %s", startDate)
      if (endDate)
        whereString += util.format(" and time < %s", endDate)

      Data.conquers(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        return callback(null, _.extend(data, { losses: result }))
      })
    },

    function (data, callback) {
      data.losses = _.map(data.losses, function (o) {
        var x = Math.floor(o.x/100),
            y = Math.floor(o.y/100)
        o.ocean = util.format("%d%d", x, y)
        return o
      })
      return callback(null, data)
    },

    function (data, callback) {
      data.title = "Alliance Losses"
      data.ally = _.sample(data.losses).oldally
      data.totalLosses = data.losses.length
      data.lossCount = _.countBy(data.losses, function (o) { return o.newally })
      data.lossCount = _.map(data.lossCount, function (k,o) { return { ally: o, count: k } })
      data.lossCount = _.sortBy(data.lossCount, 'count').reverse()

      return callback(null, data)
    }

  ], function (err, data) {
    if (err) return res.send(500, err)
    data.server = server;
    return res.render('allylosses', _.extend(defaults, data))
  })
}

exports.players = function (req, res) {
  var server = req.params.server

  Data.players(server, {}, function (err, result) {
    if (err) return res.send(500, err)
    return res.send(200, result)
  })
}

exports.player = function (req, res) {
  var server = req.params.server,
      playerId = urlencode.decode(req.params.playerId).replace(/\+/g, ' ').replace(/\'/g, "''"),
      column = (!isNaN(playerId)) ? 'id' : 'name',
      whereString = util.format("%s = '%s'", column, playerId),
      start = req.query.start || null,
      end = req.query.end || null

  var startArray = (start) ? start.split('-') : null,
      endArray   = (end)   ? end.split('-') : null,
      startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
      endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null

  async.waterfall([

    function (callback) {
      Data.players(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        return callback(null, result[0])
      })
    },

    function (player, callback) {
      if (player.alliance === 0) {
        player.alliancename = ''
        return callback(null, player)
      }

      Data.alliances(server, { ids: player.alliance }, function (err, result) {
        if (err) return callback(err)
        player.alliancename = result[0].name
        return callback(null, player)
      })
    },

    function (player, callback) {
      whereString = util.format("id = %s", player.id)

      Data.playerUpdates(server, { where: whereString, limit: 168 }, function (err, result) {
        if (err) return callback(err)
        player.updates = result
        return callback(null, player)
      })
    },

    function (player, callback) {
      player.points = accounting.formatNumber(player.points)
      player.abp = accounting.formatNumber(player.abp)
      player.dbp = accounting.formatNumber(player.dbp)

      _.map(player.updates, function (o) {
        o.time = moment.unix(o.time).format("DD/MM/Y HH") + ":00"
        o.points_delta = accounting.formatNumber(o.points_delta)
        o.abp_delta = accounting.formatNumber(o.abp_delta)
        o.dbp_delta = accounting.formatNumber(o.dbp_delta)
      })

      return callback(null, player)
    }

  ], function (err, player) {
    if (err) return res.send(500, err)

    var data = {
      title: util.format('Player: %s (%s)', player.name, server),
      player: player
    }

    return res.render('player', data)
    // return res.send(200, player)
  })
}

exports.mapCanvas = function (req, res) {
  var server = req.params.server,
      id = req.params.id || req.query.id || req.query.q || null

  async.waterfall([

    // get alliances
    function (callback) {
      Data.alliances(server, {}, function (err, result) {
        if (err) return callback(err)
        return callback(null, { alliances: result })
      })
    },

    function (data, callback) {
      if (!id) return callback(null, data)

      var query = util.format("select * from searches where id = '%s'", id)

      Data.searches({ id: id }, function (err, result) {
        if (err) return callback(err)
        
        if (!result || !result.length) return callback(null, data)

        var row = result[0]
        data.options = JSON.parse(row.options)
        
        return callback(null, data)
      })
    },

    function (data, callback) {
      if (!id) return callback(null, data)
      if (!data.options) return callback(null, data)
      if (!data.options.player || data.options.player.length === 0)
        return callback(null, data)

      var query = util.format("select id, name from players where server = '%s' and id in (%s)", server, data.options.player.join(', '))

      Data.query(query, function (err, result) {
        if (err) return callback(err)
        var players = _.indexBy(result, 'id')

        data.options.player = _.map(data.options.player, function (id) {
          return {
            id: id,
            name: players[id].name
          }
        })

        return callback(null, data)
      })
    }

  ], function (err, data) {
    if (err) return res.send(500, err)
    
    data.id = id
    data.server = server

    if (!data.options) {
      data.id = null
      data.error = 'Your map has expired.'
    }

    return res.render('mapCanvas', data)
  })
}

exports.offsets = function (req, res) {
  Data.offsets({}, function (err, result) {
    if (err) return res.send(500, err)
    return res.send(200, result)
  })
}

exports.compare = function (req, res) {
  var server = req.params.server,
      comparedAlliances = config.comparealliances

  if (req.query.ally) {
    var allies = req.query.ally,
        comparedAlliances = []
    _.each(req.query.ally, function (ids) {
      ids = ids.split(',')
      ids = _.map(ids, function (id) { return parseInt(id, 10) })
      comparedAlliances.push(ids)
    })
  }

  async.waterfall([

    function (callback) {
      Data.alliances(server, { ids: _.flatten(comparedAlliances) }, function (err, data) {
        if (err) return callback(err)
        var compareData = []

        comparedAlliances.forEach(function(row) {
          var tmp = _.filter(data, function(o) { return row.indexOf(o.id) !== -1 })
          compareData.push(tmp)
        })

        delete data

        return callback(null, compareData)
      })
    },

    function (compareData, callback) {
      var totals = [],
          data = {}

      _.each(compareData, function (row) {
        var points = _.reduce(row, function(num,o){ return num + o.points }, 0),
            towns = _.reduce(row, function(num,o){ return num + o.towns }, 0),
            members = _.reduce(row, function(num,o){ return num + o.members }, 0),
            names = _.reduce(row, function(arr,o){ return arr.concat([o.name]) }, []),
            nameStr = names.join(' / ')

        var total = {
          name: nameStr,
          points: points,
          pointsInt: points,
          towns: towns,
          members: members,
          average: {
            points: accounting.formatNumber(points/members),
            towns: accounting.formatNumber(towns/members),
            town_size: accounting.formatNumber(points/towns)
          }
        }

        totals.push(total)
      })

      totals = _.sortBy(totals, function (o) { return parseInt(o.pointsInt,10) }).reverse()
      return callback(null, totals)
    }

  ], function (err, data) {
    if (err) return res.send(500, err)
    data = _.extend(defaults, { alliances: data })
    data.title = 'Compare Alliances'
    return res.render('compare', data)
  })
}

exports.bgConquers = function (req, res) {
  var server = req.params.server,
      alliance = parseInt(config.alliance, 10),
      enemy = parseInt(config.enemy, 10),
      start = req.query.start || null,
      end = req.query.end || null,
      battleGroups = config.battlegroups,
      battleGroupIds = config.battlegroupids

  async.waterfall([

    function (callback) {
      Data.alliances(server, { ids: [alliance, enemy] }, callback)
    },

    function (data, callback) {
      data = { alliances: data }

      var whereString = util.format("newally = %d and oldally = %d", alliance, enemy),
          startArray = (start) ? start.split('-') : null,
          endArray   = (end)   ? end.split('-') : null,
          startDate  = (start) ? new Date(startArray[0], startArray[1]-1, startArray[2]).getTime() / 1000 : null,
          endDate    = (end)   ? new Date(endArray[0], endArray[1]-1, endArray[2]).getTime() / 1000 : null

      if (startDate)
        whereString += util.format(" and time > %s", startDate)
      if (endDate)
        whereString += util.format(" and time < %s", endDate)

      Data.conquers(server, { where: whereString }, function (err, result) {
        if (err) return callback(err)
        return callback(null, _.extend(data, { conquers: result }))
      })
    },

    function (data, callback) {

      var conquers = {}
          bgConquers = {},
          totalConquers = 0

      _.each(battleGroupIds, function (group, index) {
        index++

        var _conquers = _.reject(data.conquers, function (o) { return _.indexOf(group, ""+o.newplayerid) === -1 })
        
        if (!conquers[index]) { conquers[index] = _conquers }
        
        conquers[index].concat(_conquers)
        bgConquers[index] = conquers[index].length
        totalConquers += conquers[index].length
      })

      data.conquers = conquers
      data.bgConquers = bgConquers
      data.totalConquers = totalConquers

      return callback(null, data)
    },

    function (data, callback) {

      _.map(data.conquers, function (battleGroup, i) {
        battleGroup.total = bgConquers[i]
        battleGroup.players = config.battlegroups[--i].join(', ')

        return battleGroup
      })

      return callback(null, data)
    }

  ], function (err, data) {
    if (err) return res.send(500, err)

    data.title = "Battle Group Conquers"
    data.ally = _.findWhere(data.alliances, { id: alliance }).name
    data.enemy = _.findWhere(data.alliances, { id: enemy }).name

    delete data.alliances

    return res.render('bgconquers', _.extend(defaults, data))
  })
}


/* Begin API Routes */

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