var _ = require('underscore'),
  async = require('async'),
  util = require('util'),
  pg = require('pg').native,
  fs = require('fs'),
  grepolis = require('./grepolis')

require('dotenv').load()

var dbString = process.env.HEROKU_POSTGRESQL_CHARCOAL_URL

// one time use
// var islandOffsets = fs.readFileSync('./private/offsets.txt', 'utf8')

function dbInsert (config, callback) {
  var table = config.table,
      keys = config.keys,
      data = config.data

  pg.connect(dbString, function (err, client, done) {

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
      data = config.data,
      server = config.server

  pg.connect(dbString, function (err, client, done) {

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
          
          if (o.server) o.server = "'" + o.server + "'"
          if (o.name) o.name = "'" + o.name.replace(/'/g, "''") + "'"

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
          util.format("CREATE INDEX temp_%s_primary_idx ON temp_%s (server, %s)", table, table, primary)
        ]
        var query = queries.join('; ')

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
          var uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.server = s.server and t.time = s.time AND t.town = s.town RETURNING s.server, s.id ) ",
              iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(server, id) WHERE t.server IS NULL AND t.id IS NULL",
              query = util.format(uStr, table, updateStr, table)
          query += util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table)
        } else {
          var uStr = "WITH upd AS ( UPDATE %s t SET %s FROM temp_%s s WHERE t.server = s.server and t.%s = s.%s RETURNING s.server, s.%s ) ",
              iStr = "INSERT INTO %s (%s) SELECT %s FROM temp_%s s LEFT JOIN upd t USING(server, %s) WHERE t.server IS NULL AND t.%s IS NULL",
              query = util.format(uStr, table, updateStr, table, primary, primary, primary)
          query += util.format(iStr, table, keys.join(', ').toLowerCase(), keys.join(', ').toLowerCase(), table, primary, primary)
        }
        // if (table === 'alliances') {
        //   console.log(query)
        //   process.exit()
        // }
        
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

exports.hourly = function (server, callback) {
  var players = [],
      alliances = [],
      dbPlayers = {},
      dbAlliances = {},
      defaults = { server: server }

  async.waterfall([

    // import island offsets - one time use
    // function (callback) {
    //   var data = grepolis.parseData("island_offsets", islandOffsets),
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

    // update disbanded alliances
    function (callback) {
      async.waterfall([

        function (callback) {
          console.log("updating disbanded alliances")
          grepolis.getAlliances(server, function (err, data) {
            if (err) return callback(err)

            var alliances = _.pluck(data, 'id')
            alliances = _.map(alliances, function (n) { return parseInt(n,10) })

            return callback(null, alliances)
          })
        },

        function (alliances, callback) {
          var query = util.format("select id from alliances where server = '%s' and deleted != true order by rank asc", server)

          dbQuery(query, function (err, result) {
            if (err) return callback(err)
            
            var data = {
              alliances: alliances,
              dbAlliances: _.pluck(result, 'id')
            }

            return callback(null, data)
          })
        },

        function (data, callback) {
          var deleted = _.difference(data.dbAlliances, data.alliances)

          if (!deleted && !deleted.length)
            return callback(null)

          var query = util.format("update alliances set deleted = true where server = '%s' and id in (%s)", server, deleted.join(','))
          
          dbQuery(query, function (err, result) {
            if (err) console.log(err)
            return callback(null, result)
          })
        }
        
      ], function (err, result) {
        if (err) console.log(err)
        console.log("finished updating disbanded alliances")
        return callback(null)
      })
    },
    
    // query players to get deltas
    function (callback) {
      var query = util.format("select * from players where server = '%s' order by rank asc", server)

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
      var query = util.format("select * from alliances where server = '%s' order by rank asc", server)

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
      grepolis.getPlayersFull(server, function (err, data) {
        if (err) return callback(err)

        players = data

        var keys = Object.keys(data[0]),
            config = _.extend(defaults, { table: 'players', keys: keys, data: data })

        console.log('importing players')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err) }
          return callback(null, result)
        })
      })
    },

    // import alliances
    function (result, callback) {
      grepolis.getAlliancesFull(server, function (err, data) {
        if (err) return callback(err)

        alliances = data

        var keys = Object.keys(data[0]),
            config = _.extend(defaults, { table: 'alliances', keys: keys, data: data })

        console.log('importing alliances')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err) }
          return callback(null, result)
        })
      })
    },

    // import towns
    function (result, callback) {
      grepolis.getTowns(server, function (err, data) {
        if (err) return callback(err)

        var keys = Object.keys(data[0]),
            config = _.extend(defaults, { table: 'towns', keys: keys, data: data })

        console.log('importing towns')
        dbUpsert(config, function (err, result) {
          if (err) { return callback(err) }
          return callback(null, result)
        })

      })
    },

    // import conquers
    function (result, callback) {
      grepolis.getConquers(server, function (err, data) {
        if (err) { return callback(err) }
        if (!data || !data.length)
          return callback(null, {})

        // Add id field and value since auto increment doesn't work without it
        data = _.map(data, function (o) {
          var tmp = { id: "nextval('conquers_id_seq')" }
          o = _.extend(tmp, o)
          return o
        })

        var keys = Object.keys(data[0]),
            config = _.extend(defaults, { table: 'conquers', keys: keys, data: data })

        console.log('importing conquers')
        dbUpsert(config, function (err, result) {
          if (err) return callback(err)
          return callback(null, result)
        })
      })
    },

    // import islands
    function (result, callback) {
      grepolis.getIslands(server, function (err, data) {
        if (err) return callback(err)

        var keys = Object.keys(data[0]),
            config = _.extend(defaults, { table: 'islands', keys: keys, data: data })

        console.log('importing islands')
        dbUpsert(config, function (err, result) {
          if (err) return callback(err)
          return callback(null, result)
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
          config = _.extend(defaults, { table: 'player_updates', keys: keys, data: data })

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

        return a
      })

      return callback(null, alliances)
    },

    // insert alliance updates
    function (data, callback) {
      var keys = Object.keys(data[0]),
          config = _.extend(defaults, { table: 'alliance_updates', keys: keys, data: data })

      console.log('importing alliance updates')
      dbInsert(config, function (err, result) {
        if (err) return callback(err)
        return callback(null, result)
      })
    }

  ], function (err, result) {
    if (err) return callback(err)
    return callback(null, result)
  })
}

exports.daily = function (server, callback) {

}

exports.cleanup = function (callback) {
  async.waterfall([

    // remove old player updates (14 days)
    function (callback) {
      var diff = 14 * 24 * 60 * 60,
          time = new Date() / 1000
          cutoff = Math.round(time - diff - 3600),
          query = util.format("delete from player_updates where time < %d", cutoff)

      console.log("removing old player updates")
      dbQuery(query, function (err, result) {
        if (err) return callback(err)
        return callback(null)
      })
    },

    // remove old alliance updates (14 days)
    function (callback) {
      var diff = 14 * 24 * 60 * 60,
          time = new Date() / 1000
          cutoff = Math.round(time - diff - 3600),
          query = util.format("delete from player_updates where time < %d", cutoff)

      console.log("removing old alliance updates")
      dbQuery(query, function (err, result) {
        if (err) return callback(err)
        return callback(null)
      })
    }

    ], function (err) {
      if (err) return callback(err)
      return callback(null)
    })
}

exports.init = function (frequency, callback) {

  var query = "select * from worlds order by server asc"

  console.log('fetching worlds')
  dbQuery(query, function (err, result) {
    if (err) return callback(err)

    var servers = _.pluck(result, 'server')

    console.log('starting all imports')

    async.eachSeries(servers, function (server, iteratorCallback) {
      console.log(util.format('importing world data for %s at %s', server, new Date()))

      if (frequency == 'hourly') {
        exports.hourly(server, function (err, result) {
          if (err) return iteratorCallback(err)
          console.log(util.format('import completed for %s at %s', server, new Date()))
          return iteratorCallback()
        })
      } else if (frequency === 'daily') {
        exports.daily(server, function (err, result) {
          if (err) return iteratorCallback(err)
          console.log(util.format('import completed for %s at %s', server, new Date()))
          return iteratorCallback()
        })
      }

    }, function (err) {
      if (err) return console.error(err)
      console.log('finished all imports')

      exports.cleanup(function () {
        console.log('finished cleanup')
      })
    })
  })

}