var _ = require('underscore'),
  urlencode = require('urlencode'),
  async = require('async'),
  http = require('http'),
  zlib = require('zlib'),
  util = require('util'),
  pg = require('pg'),
  fs = require('fs'),
  url = "http://%s.grepolis.com/data/%s.txt.gz"

require('dotenv').load()

var pgConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: true
}

var keys = {
  alliances:        "id,name,points,towns,members,rank",
  players:          "id,name,alliance,points,rank,towns",
  towns:            "id,player,name,x,y,islandNo,points",
  islands:          "id,x,y,type,availableSpots,plus,minus",
  conquers:         "town,time,newPlayer,oldPlayer,newAlly,oldAlly",
  player_kills_all: "rank,id,points",
  player_kills_att: "rank,id,points",
  player_kills_def: "rank,id,points",
  alliance_kills_all: "rank,id,points",
  alliance_kills_att: "rank,id,points",
  alliance_kills_def: "rank,id,points",
  island_offsets:   "id,offsetx,offsety,pos",
}

// one time use
// var islandOffsets = fs.readFileSync('./private/offsets.txt', 'utf8')

function parseData (endpoint, data) {
  var dataArray = [],
    lines = data.split("\n"),
    _keys = keys[endpoint].split(',')

  lines.forEach(function (row) {
    if (row.length) {
      row = row.split(',')
      dataArray.push(_.object(_keys, row))
    }
  })

  return dataArray
}

function getData (server, endpoint, callback) {
  var _url = util.format(url, server, endpoint)

  http.get(_url, function (res) {
    var gunzip = zlib.createUnzip(),
      	output = ""

    res.pipe(gunzip)

    gunzip.on('data', function (data) {
      output += data.toString()
    })

    gunzip.on('end', function () {
      var response = {}
      
      response.data = parseData(endpoint, output)
      response.content_length = res.headers['content-length']

      return callback(null, response)
    })

  }).on('error', function (e) {
    return callback(e)
  })
}

function parseName(name) {
  return urlencode.decode(name).replace(/\+/g, ' ')
}

function getPlayers (server, callback) {

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

function getPlayerStats (server, stat, callback) {

  getData(server, stat, function (err, results) {
    if (err) { return callback(err) }
    var players = {}

    _.each(results.data, function (o) {
      players[o.id] = o
    })

    return callback(null, players)
  })
}

function getPlayersFull (server, callback) {

  async.waterfall([

    function (callback) {
      data = {}
      
      getPlayerStats(server, 'player_kills_att', function (err, results) {
        if (err) { return callback(err) }
        data.abp = results
        return callback(null, data)
      })
    },

    function (data, callback) {

      getPlayerStats(server, 'player_kills_def', function (err, results) {
        if (err) { return callback(err) }
        data.dbp = results
        return callback(null, data)
      })
    },

    function (data, callback) {
      
      getPlayers(server, function (err, players) {
        players = _.map(players, function (o) {
          o.abp = parseInt(data.abp[o.id].points,10)
          o.dbp = parseInt(data.dbp[o.id].points,10)
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

function getAlliances (server, callback) {

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

function getAllianceStats (server, stat, callback) {

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

function getAlliancesFull (server, callback) {
  async.waterfall([

    function (callback) {
      data = {}
      
      getAllianceStats(server, 'alliance_kills_att', function (err, results) {
        if (err) { return callback(err) }
        data.abp = results
        return callback(null, data)
      })
    },

    function (data, callback) {

      getAllianceStats(server, 'alliance_kills_def', function (err, results) {
        if (err) { return callback(err) }
        data.dbp = results
        return callback(null, data)
      })
    },

    function (data, callback) {
      
      getAlliances(server, function (err, alliances) {
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

function getTowns (server, callback) {
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

function getIslands (server, callback) {
  getData(server, 'islands', function (err, results) {
    if (err) { return callback(err) }
    var islands = results.data
    return callback(null, islands)
  })
}

function getConquers (server, callback) {
  
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

function dbInsert (config, callback) {
  var table = config.table,
      keys = config.keys,
      data = config.data

  pg.connect(pgConfig, function (err, client, done) {

    var handleError = function (err, callback) {
      if (!err) return false

      if (client) done(client)

      console.error(err)
      return callback(err)
    }

    if (handleError(err, callback)) return

    var values = _.chain(data)
      .groupBy(function (el, i) {
        return Math.floor(i/100)
      })
      .toArray()
      .map(function (list) {
        list = _.map(list, function (o) {
          return util.format('(%s)', _.values(o).join(', '))
        })
        return list.join(', ')
      })
      .value()

    async.eachSeries(values, function (list, cb) {

      var query = util.format("INSERT INTO %s (%s) VALUES %s", table, keys.join(', '), list)

      client.query({ text: query }, function (err, result) {
        if (err) return cb(err)
        return cb(err, result)
      })
    }, function (err, result) {
      if (err) return callback(err)
      
      done()
      pg.end()
      
      return callback(null, result)
    })

  })
}

function dbUpsert (config, callback) {
  var table = config.table,
      primary = config.primary || 'id',
      keys = config.keys,
      data = config.data

  pg.connect(pgConfig, function (err, client, done) {

    var handleError = function (err, callback) {
      if (!err) return false

      if (client) done(client)

      console.error(err)
      return callback(err)
    }

    if (handleError(err, callback)) return

    var values = _.chain(data)
      .groupBy(function (el, i) { // split values into groups of 100
        return Math.floor(i/100)
      })
      .toArray() // convert to array
      .map(function (list) { // map value arrays to insert strings
        list = _.map(list, function (o) {
          if (o.name) {
            o.name = "'" + o.name.replace(/'/g, "''") + "'"
          }
          if (o.plus) {
              o.plus = "'" + o.plus + "'"
              o.minus = "'" + o.minus + "'"
            }
          return util.format('(%s)', _.values(o).join(', '))
        })
        return list.join(', ')
      }).value()

    async.waterfall([

      function (callback) {
        var queries = [
          util.format("DROP TABLE IF EXISTS temp_%s", table),
          util.format("CREATE TABLE temp_%s (like %s)", table, table),
          util.format("CREATE INDEX temp_%s_primary_idx ON temp_%s (%s)", table, table, primary)
        ];
        var query = queries.join('; ');

        client.query({ text: query }, function (err, result) {
          if (err) return callback(err)
          return callback(null, result)
        })
      },

      function (result, callback) {

        async.eachSeries(values, function (list, cb) {

          var query = util.format("INSERT INTO temp_%s (%s) VALUES %s", table, keys.join(', '), list)

          client.query({ text: query }, function (err, result) {
            if (err) return cb(err)
            return cb(err, result)
          })
        }, function (err, result) {
          if (err) return callback(err)
          return callback(null, result)
        })

      },

      function (lastResult, callback) {
        var updateArr = [],
            updateStr = ""

        _.each(keys, function (k) {
          if (k === primary) return
          updateArr.push(util.format("%s = s.%s", k.toLowerCase(), k.toLowerCase()))
        })
        updateStr = updateArr.join(', ')

        if (table === 'conquers') {
          var uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.time = s.time AND t.town = s.town RETURNING s.id ) ",
              iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(id) WHERE t.id IS NULL",
              query = util.format(uStr, table, updateStr, table)
          query += util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table)
        } else {
          var uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.%s = s.%s RETURNING s.%s ) ",
              iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(%s) WHERE t.%s IS NULL",
              query = util.format(uStr, table, updateStr, table, primary, primary, primary)
          query += util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table, primary, primary)
        }

        client.query({ text: query }, function (err, result) {
          if (err) return callback(err)
          return callback(null, lastResult)
        })

      },

      function (lastResult, callback) {
        var query = util.format("DROP TABLE temp_%s", table)

        client.query({ text: query }, function (err, result) {
          if (err) return callback(err)
          return callback(null, lastResult)
        })
      }

    ], function (err, result) {
      done()
      pg.end()

      if (err) return callback(err)
      return callback(null, result)
    })

  })
}

function dbQuery (query, callback) {

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

exports.do = function (server, callback) {
  var players = [],
      alliances = [],
      dbPlayers = {},
      dbAlliances = {}

  async.waterfall([

    // import island offsets - one time use
    // function (callback) {
    //   var data = parseData("island_offsets", islandOffsets),
    //       keys = Object.keys(data[0]),
    //       config = { table: 'offsets', keys: keys, data: data }

    //   console.log(data.length)

    //   dbUpsert(config, function (err, results) {
    //     if (err) { return callback(err) }
    //     console.log(results)
    //     process.exit()
    //     return callback(null, results)
    //   })
    // },
    
    // query players to get deltas
    function (callback) {
      var query = "select * from players order by rank asc"

      console.log('fetching players')
      dbQuery(query, function (err, result) {
        if (err) return callback(err)

        result = _.indexBy(result, 'id')
        dbPlayers = result

        return callback(null, result)
      })
    },

    // query alliances to get deltas
    function (result, callback) {
      var query = "select * from alliances order by rank asc"

      console.log('fetching alliances')
      dbQuery(query, function (err, result) {
        if (err) return callback(err)
        
        result = _.indexBy(result, 'id')
        dbAlliances = result

        return callback(null, result)
      })
    },

    // import players
    function (result, callback) {
      getPlayersFull(server, function (err, data) {
        if (err) return callback(err)

        players = data

        var keys = Object.keys(data[0]),
            config = { table: 'players', keys: keys, data: data }

        console.log('importing players')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err) }
          return callback(null, result)
        })
      })
    },

    // import alliances
    function (result, callback) {
      getAlliancesFull(server, function (err, data) {
        if (err) return callback(err)

        alliances = data

        var keys = Object.keys(data[0]),
            config = { table: 'alliances', keys: keys, data: data }

        console.log('importing alliances')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err) }
          return callback(null, result)
        })
      })
    },

    // import towns
    function (result, callback) {
      getTowns(server, function (err, data) {
        if (err) return callback(err)

        var keys = Object.keys(data[0]),
            config = { table: 'towns', keys: keys, data: data }

        console.log('importing towns')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err) }
          return callback(null, result)
        })

      })
    },

    // import conquers
    function (result, callback) {
      getConquers(server, function (err, data) {
        if (err) { return callback(err) }

        // Add id field and value since auto increment doesn't work without it
        data = _.map(data, function (o) {
          var tmp = { id: "nextval('conquers_id_seq')" }
          o = _.extend(tmp, o)
          return o
        })

        var keys = Object.keys(data[0]),
            config = { table: 'conquers', keys: keys, data: data }

        console.log('importing conquers')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        })
      })
    },

    // import islands
    function (result, callback) {
      getIslands(server, function (err, data) {
        if (err) { return callback(err); }

        var keys = Object.keys(data[0]),
            config = { table: 'islands', keys: keys, data: data }

        console.log('importing islands')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err); }
          return callback(null, result);
        })
      })
    },

    // map deltas back to players from db
    function (result, callback) {
      var now = Math.floor( new Date() / 1000)
      _.map(players, function (p) {
        var o = dbPlayers[p.id]
        
        if (!o)
          o = p

        p.time = now
        p.towns_delta = p.towns - o.towns
        p.points_delta = p.points - o.points
        p.abp_delta = p.abp - o.abp
        p.dbp_delta = p.dbp - o.dbp

        return p
      })

      return callback(null, players)
    },

    // insert player updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = { table: 'player_updates', keys: keys, data: data }

      console.log('importing player updates')
      dbInsert(config, function (err, result) {
        if (err)
          return callback(err)
        return callback(null, result)
      })
    },

    // map deltas back to alliances from db
    function (result, callback) {
      var now = Math.floor( new Date() / 1000)
      _.map(alliances, function (a) {
        var o = dbAlliances[a.id]
        
        if (!o)
          o = a

        a.time = now
        a.abp = a.abp || 0
        a.dbp = a.dbp || 0
        a.towns_delta = a.towns - o.towns
        a.points_delta = a.points - o.points
        a.members_delta = a.members - o.members
        a.abp_delta = a.abp - o.abp
        a.dbp_delta = a.dbp - o.dbp

        return a;
      })

      return callback(null, alliances)
    },

    // insert alliance updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = { table: 'alliance_updates', keys: keys, data: data }

      console.log('importing alliance updates')
      dbInsert(config, function (err, result) {
        if (err) return callback(err)
        return callback(null, result)
      })
    }

  ], function (err, result) {
    if (err) return callback(err);
    return callback(null, result);
  })
}