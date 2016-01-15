var _ = require('underscore'),
    urlencode = require('urlencode'),
    http = require('http'),
    zlib = require('zlib'),
    util = require('util'),
    async = require('async'),
    url = "http://%s.grepolis.com/data/%s.txt.gz"

var keys = {
  alliances:        "id,name,points,towns,members,rank",
  players:          "id,name,alliance,points,rank,towns",
  towns:            "id,player,name,x,y,islandNo,points",
  islands:          "id,x,y,type,availableSpots,plus,minus",
  conquers:         "town,time,newPlayer,oldPlayer,newAlly,oldAlly,points",
  player_kills_all: "rank,id,points",
  player_kills_att: "rank,id,points",
  player_kills_def: "rank,id,points",
  alliance_kills_all: "rank,id,points",
  alliance_kills_att: "rank,id,points",
  alliance_kills_def: "rank,id,points",
  island_offsets:   "id,offsetx,offsety,pos",
}

function parseData (server, endpoint, data) {
  var dataArray = [],
    lines = data.split("\n"),
    _keys = keys[endpoint].split(',')
    _keys.push('server')

  lines.forEach(function (row) {
    if (row.length) {
      row = row.split(',')
      row.push(server)
      dataArray.push(_.object(_keys, row))
    }
  })

  return dataArray
}

exports.parseData = parseData

function getData (server, endpoint, callback) {
  var _url = util.format(url, server, endpoint)
  console.log(_url)
  http.get(_url, function (res) {
    if (res.headers['content-type'] !== 'application/octet-stream')
      return callback(null, {})
    var gunzip = zlib.createUnzip(),
        output = ""

    res.pipe(gunzip)

    gunzip.on('data', function (data) {
      output += data.toString()
    })

    gunzip.on('end', function () {
      var response = {}
      
      response.data = parseData(server, endpoint, output)
      response.content_length = res.headers['content-length']

      return callback(null, response)
    })

  }).on('error', function (e) {
    return callback(e)
  })
}

exports.getData = getData

function parseName(name) {
  return urlencode.decode(name).replace(/\+/g, ' ')
}

exports.getPlayers = function (server, callback) {

  getData(server, 'players', function (err, results) {
    if (err) { return callback(err) }
    
    results.data = _.map(results.data, function (o) {
      o.name = parseName(o.name)
      return o
    })

    results.data = _.sortBy(results.data, function (o) { return parseInt(o.rank, 10) })
    
    return callback(null, results.data)
  })
}

exports.getPlayerStats = function (server, stat, callback) {

  getData(server, stat, function (err, results) {
    if (err) { return callback(err) }
    var players = {}

    _.each(results.data, function (o) {
      players[o.id] = o
    })

    return callback(null, players)
  })
}

exports.getPlayersFull = function (server, callback) {

  async.waterfall([

    function (callback) {
      data = {}
      
      exports.getPlayerStats(server, 'player_kills_att', function (err, results) {
        if (err) { return callback(err) }
        data.abp = results
        return callback(null, data)
      })
    },

    function (data, callback) {

      exports.getPlayerStats(server, 'player_kills_def', function (err, results) {
        if (err) { return callback(err) }
        data.dbp = results
        return callback(null, data)
      })
    },

    function (data, callback) {
      
      exports.getPlayers(server, function (err, players) {
        players = _.map(players, function (o) {
          o.abp = (data.abp[o.id]) ? parseInt(data.abp[o.id].points,10) : 0
          o.dbp = (data.dbp[o.id]) ? parseInt(data.dbp[o.id].points,10) : 0
          o.alliance = o.alliance.length ? parseInt(o.alliance, 10) : 0
          return o
        })

        return callback(null, players)
      })
    }

    ], function (err, players) {
      if (err) { return callback(err) }
      return callback(null, players)
    })
}

exports.getAlliances = function (server, callback) {

  getData(server, 'alliances', function (err, results) {
    if (err) { return callback(err) }
    var alliances = results.data

    alliances = _.map(alliances, function (o) {
      o.name = parseName(o.name)
      return o
    })

    alliances = _.sortBy(alliances, function (o) { return parseInt(o.rank, 10) })

    return callback(null, alliances)
  })
}

exports.getAllianceStats = function (server, stat, callback) {

  getData(server, stat, function (err, results) {
    if (err) 
      return callback(err)

    var alliances = {}

    _.each(results.data, function (o) {
      alliances[o.id] = o
    })

    return callback(null, alliances)
  })
}

exports.getAlliancesFull = function (server, callback) {
  async.waterfall([

    function (callback) {
      data = {}
      
      exports.getAllianceStats(server, 'alliance_kills_att', function (err, results) {
        if (err) { return callback(err) }
        data.abp = results
        return callback(null, data)
      })
    },

    function (data, callback) {

      exports.getAllianceStats(server, 'alliance_kills_def', function (err, results) {
        if (err) { return callback(err) }
        data.dbp = results
        return callback(null, data)
      })
    },

    function (data, callback) {
      
      exports.getAlliances(server, function (err, alliances) {
        alliances = _.map(alliances, function (o) {
          o.abp = parseInt(data.abp[o.id].points,10)
          o.dbp = parseInt(data.dbp[o.id].points,10)
          return o
        })

        return callback(null, alliances)
      })
    }

    ], function (err, alliances) {
      if (err) { return callback(err) }
      return callback(null, alliances)
    })
}

exports.getTowns = function (server, callback) {
  getData(server, 'towns', function (err, results) {
    if (err) { return callback(err) }
    var towns = results.data
    
    towns = _.map(towns, function(o) {
      o.name = parseName(o.name)
      o.player = (o.player && o.player.length) ? parseInt(o.player, 10) : 0
      return o
    })

    return callback(null, towns)
  })
}

exports.getIslands = function (server, callback) {
  getData(server, 'islands', function (err, results) {
    if (err) { return callback(err) }
    var islands = results.data
    return callback(null, islands)
  })
}

exports.getConquers = function (server, callback) {
  
  getData(server, 'conquers', function (err, results) {
    if (err) { return callback(err) }
    var conquers = results.data

    conquers = _.map(conquers, function (o) {
      o.newPlayer = (o.newPlayer && o.newPlayer.length) ? parseInt(o.newPlayer, 10) : 0
      o.oldPlayer = (o.oldPlayer && o.oldPlayer.length) ? parseInt(o.oldPlayer, 10) : 0
      o.newAlly = (o.newAlly && o.newAlly.length) ? parseInt(o.newAlly, 10) : 0
      o.oldAlly = (o.oldAlly && o.oldAlly.length) ? parseInt(o.oldAlly, 10) : 0

      return o
    })

    return callback(null, conquers)
  })
}