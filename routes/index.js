
/*
 * GET home page.
 */

var _ = require('underscore'),
  async = require('async'),
  accounting = require('accounting'),
  utils = require('Grepolis-Utils'),
  defaults = { title: 'Grepolis Tools' };

exports.index = function(req, res) {
  res.render('index', defaults);
};

exports.calculate = function (req, res) {
  if (!req.body) { return res.send(500, 'Error.'); }

  if (req.body.travel && req.body.arrival) {
    var payload = _.extend(defaults, req.body, {
        departure: utils.getDepartureTime(req.body.travel, req.body.arrival)
      });
  }

  if (req.body.level) {
    var payload = _.extend(defaults, req.body, {
        culture: utils.getCps(req.body.level)
      });
  }

  if (!payload) {
    return res.send(500, 'Error.');
  }

  res.render('index', payload);
};

exports.rank = function (req, res) {
  var alliances = [20, 3222, 2243, 1759],
    alliance_players = [],
    players = {};

    async.waterfall([

      // get players/points
      function (callback) {
        utils.getData('us39', 'players', function (err, data) {
          if (err) { return callback(err); }
          // console.log(alliances);
          data = _.filter(data, function (o) { return alliances.indexOf(parseInt(o.alliance,10)) !== -1; });
          data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
          data.forEach(function (o,i) {
            alliance_players.push(parseInt(o.id, 10));
            players[o.id] = o;
            players[o.id]['rank_world'] = parseInt(o.rank,10);
            players[o.id]['rank'] = i;
            players[o.id]['rank_points'] = (75 - o.rank) <= 0 ? 1 : (75 - o.rank);
          });

          return callback(null, players);
        });
      },

      // get abp
      function (players, callback) {
        utils.getData('us39', 'player_kills_att', function (err, data) {
          if (err) { return callback(err); }
          data = _.filter(data, function(o) { return alliance_players.indexOf(parseInt(o.id,10)) !== -1; });
          data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
          data.forEach(function (o,i) {
            players[o.id]['abp'] = o.points;
            players[o.id]['abp_rank'] = parseInt(i,10)+1;
            players[o.id]['abp_rank_world'] = parseInt(o.rank,10);
            players[o.id]['abp_points'] = (75 - players[o.id]['abp_rank']) <= 0 ? 1 : (75 - players[o.id]['abp_rank']);
          });
          return callback(null, players);
        });
      },

      // get dbp
      function (players, callback) {
        utils.getData('us39', 'player_kills_def', function (err, data) {
          data = _.filter(data, function(o) { return alliance_players.indexOf(parseInt(o.id,10)) !== -1; });
          data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
          data.forEach(function (o,i) {
            players[o.id]['dbp'] = o.points;
            players[o.id]['dbp_rank'] = parseInt(i,10)+1;
            players[o.id]['dbp_rank_world'] = parseInt(o.rank,10);
            players[o.id]['dbp_points'] = (75 - players[o.id]['dbp_rank']) <= 0 ? 1 : (75 - players[o.id]['dbp_rank']);
          });
          return callback(null, players);
        });
      },

      // parse numbers
      function (players, callback) {
        players = _.map(players, function (o) {
          o.tbp = accounting.formatNumber(parseInt(o.abp,10) + parseInt(o.dbp,10));
          o.total_points = o.rank_points + o.abp_points + o.dbp_points;
          o.name = o.name.replace(/\+/g,' ');
          o.points = accounting.formatNumber(parseInt(o.points,10));
          o.abp = accounting.formatNumber(parseInt(o.abp,10));
          o.dbp = accounting.formatNumber(parseInt(o.dbp,10));
          o.rank = parseInt(o.rank,10);
          return o;
        });

        players = _.sortBy(players, function (o) { return o.total_points; }).reverse();

        players.forEach(function (o,i) {
          o.alliance_rank = i+1;
        });

        return callback(null, players);
      }

    ], function (err, players) {
      if (err) { return res.send(500, err); }
      // return res.send(200, players);
      return res.render('rank', {players: players});
    });

};

exports.rank2 = function (req, res) {
  var alliances = [20, 3222, 2243, 1759],
    alliance_players = [],
    players = {};

    async.waterfall([

      // get players/points
      function (callback) {
        utils.getData('us39', 'players', function (err, data) {
          if (err) { return callback(err); }
          // console.log(alliances);
          data = _.filter(data, function (o) { return alliances.indexOf(parseInt(o.alliance,10)) !== -1; });
          data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
          data.forEach(function (o,i) {
            alliance_players.push(parseInt(o.id, 10));
            players[o.id] = o;
            players[o.id]['rank_world'] = parseInt(o.rank,10);
            players[o.id]['rank'] = i;
          });

          data.forEach(function (o,i) {
            players[o.id]['rank_points'] = (alliance_players.length - o.rank);
          });

          return callback(null, players);
        });
      },

      // get abp
      function (players, callback) {
        utils.getData('us39', 'player_kills_att', function (err, data) {
          if (err) { return callback(err); }
          data = _.filter(data, function(o) { return alliance_players.indexOf(parseInt(o.id,10)) !== -1; });
          data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
          data.forEach(function (o,i) {
            players[o.id]['abp'] = o.points;
            players[o.id]['abp_rank'] = parseInt(i,10);
            players[o.id]['abp_rank_world'] = parseInt(o.rank,10);
            players[o.id]['abp_points'] = (alliance_players.length - players[o.id]['abp_rank']);
          });
          return callback(null, players);
        });
      },

      // get dbp
      function (players, callback) {
        utils.getData('us39', 'player_kills_def', function (err, data) {
          data = _.filter(data, function(o) { return alliance_players.indexOf(parseInt(o.id,10)) !== -1; });
          data = _.sortBy(data, function (o) { return parseInt(o.rank,10); });
          data.forEach(function (o,i) {
            players[o.id]['dbp'] = o.points;
            players[o.id]['dbp_rank'] = parseInt(i,10);
            players[o.id]['dbp_rank_world'] = parseInt(o.rank,10);
            players[o.id]['dbp_points'] = (alliance_players.length - players[o.id]['dbp_rank']);
          });
          return callback(null, players);
        });
      },

      // parse numbers
      function (players, callback) {
        players = _.map(players, function (o) {
          o.tbp = accounting.formatNumber(parseInt(o.abp,10) + parseInt(o.dbp,10));
          o.total_points = o.rank_points + o.abp_points + o.dbp_points;
          o.name = o.name.replace(/\+/g,' ');
          o.points = accounting.formatNumber(parseInt(o.points,10));
          o.abp = accounting.formatNumber(parseInt(o.abp,10));
          o.dbp = accounting.formatNumber(parseInt(o.dbp,10));
          o.rank = parseInt(o.rank,10);
          return o;
        });

        players = _.sortBy(players, function (o) { return o.total_points; }).reverse();

        players.forEach(function (o,i) {
          o.alliance_rank = i+1;
        });

        return callback(null, players);
      }

    ], function (err, players) {
      if (err) { return res.send(500, err); }
      // return res.send(200, players);
      return res.render('rank', {players: players});
    });

};

exports.conquers = function (req, res) {
  var compared_alliances = [
    [20, 3222, 2243, 1759],
    [3615, 3617, 1082, 1502, 1933]
  ],
  all_alliances = [];
  compare_data = [],
  conquer_data = [],
  total_data = [];

  async.waterfall([

    function (callback) {
      utils.getData('us39', 'alliances', function (err, data) {
        if (err) { return callback(err); }
        var alliances = _.sortBy(data, function(o){ return parseInt(o.rank, 10); });
        all_alliances = alliances;

        compared_alliances.forEach(function(row) {
          var tmp = _.filter(alliances, function(o) { return row.indexOf(parseInt(o.id,10)) !== -1; });
          compare_data.push(tmp);
        });

        _.map(compare_data, function (row) {
          _.map(row, function (o) {
            o.name = o.name.replace(/\+/g,' ');
            o.points = parseInt(o.points,10);
            o.towns = parseInt(o.towns,10);
            o.members = parseInt(o.members,10);
            o.rank = parseInt(o.rank,10);
            return o;
          });

          var points = _.reduce(row, function(num,o){ return num + parseInt(o.points,10); }, 0),
              towns = _.reduce(row, function(num,o){ return num + parseInt(o.towns,10); }, 0),
              members = _.reduce(row, function(num,o){ return num + parseInt(o.members,10); }, 0),
              names = _.reduce(row, function(arr,o){ return arr.concat([o.name]); }, []),
              nameStr = names.join('/');

          var total = {
            name: nameStr,
            points: accounting.formatNumber(points),
            towns: accounting.formatNumber(towns),
            members: members,
            average: {
              points: accounting.formatNumber(points/members),
              towns: accounting.formatNumber(towns/members)
            }
          };

          total_data.push(total);

        });

        return callback(null, compare_data);
      });
    },

    function (compare_data, callback) {

      utils.getData('us39', 'conquers', function (err, data) {
        if (err) { return callback(err); }
        var enemies = [];

        enemies = compared_alliances[1];
        compare_data[0].forEach(function (ally) {

          var tmp = data,
              conquers = _.filter(tmp, function (o) { return parseInt(ally.id,10) === parseInt(o.newAlly,10); }),
              losses = _.filter(tmp, function (o) { return parseInt(ally.id,10) === parseInt(o.oldAlly,10); });

          ally.conquers = _.filter(conquers, function (o) { return enemies.indexOf(parseInt(o.oldAlly,10)) !== -1; }).length;
          ally.losses = _.filter(losses, function (o) { return enemies.indexOf(parseInt(o.newAlly,10)) !== -1; }).length;

        });

        enemies = compared_alliances[0];
        compare_data[1].forEach(function (ally) {

          var tmp = data,
              conquers = _.filter(tmp, function (o) { return parseInt(ally.id,10) === parseInt(o.newAlly,10); }),
              losses = _.filter(tmp, function (o) { return parseInt(ally.id,10) === parseInt(o.oldAlly,10); });

          ally.conquers = _.filter(conquers, function (o) { return enemies.indexOf(parseInt(o.oldAlly,10)) !== -1; }).length;
          ally.losses = _.filter(losses, function (o) { return enemies.indexOf(parseInt(o.newAlly,10)) !== -1; }).length;

        });

        return res.send(200, {totals: total_data, alliances: compare_data});

      });
    }

  ], function (err, data) {
    if (err) { return res.send(500, err); }
    return res.send(200, data);
  });

  // utils.getData('us39', 'conquers', function (err, data) {
  //   if (err) { return; }
  //   var conquer_data = {};

    // compared_alliances.forEach(function(row) {
    //   var tmp = _.filter(alliances, function(o) { return row.indexOf(parseInt(o.id,10)) !== -1; });
    //   compare_data.push(tmp);
    // });

  //   var tmp = _.filter(data, function(o) { return compared_alliances[0].indexOf(parseInt(o.newAlly,10)) !== -1; });
  //   tmp = _.filter(tmp, function(o) { return compared_alliances[1].indexOf(parseInt(o.oldAlly,10)) !== -1; });

  //   conquer_data['Unsullied'] = tmp.length;

  //   var tmp = _.filter(data, function(o) { return compared_alliances[1].indexOf(parseInt(o.newAlly,10)) !== -1; });
  //   tmp = _.filter(tmp, function(o) { return compared_alliances[0].indexOf(parseInt(o.oldAlly,10)) !== -1; });

  //   conquer_data['Commission'] = tmp.length;

  //   res.send(200, conquer_data);
  // });

};

exports.conquers1 = function (req, res) {
  compared_alliances = [
    [20, 3222, 2243, 1759],
    [3615, 3617, 1082, 1502, 1933]
  ];

  utils.getData('us39', 'conquers', function (err, data) {
    if (err) { return; }
    var conquer_data = {};

    var tmp = _.filter(data, function(o) { return compared_alliances[0].indexOf(parseInt(o.newAlly,10)) !== -1; });
    tmp = _.filter(tmp, function(o) { return compared_alliances[1].indexOf(parseInt(o.oldAlly,10)) !== -1; });

    conquer_data['Unsullied'] = tmp.length;

    var tmp = _.filter(data, function(o) { return compared_alliances[1].indexOf(parseInt(o.newAlly,10)) !== -1; });
    tmp = _.filter(tmp, function(o) { return compared_alliances[0].indexOf(parseInt(o.oldAlly,10)) !== -1; });

    conquer_data['Commission'] = tmp.length;

    res.send(200, conquer_data);
  });

};

exports.compare = function (req, res) {
  var compared_alliances = [
    [20, 3222, 2243, 1759],
    [3615, 3617, 1082, 1502, 1933]
  ];

  utils.getData('us39', 'alliances', function (err, data) {
    if (err) { return; }
    var alliances = _.sortBy(data, function(o){ return parseInt(o.rank, 10); }).slice(0,30),
        compare_data = [],
        conquer_data = [],
        total_data = [],
        payload = {};

    compared_alliances.forEach(function(row) {
      var tmp = _.filter(alliances, function(o) { return row.indexOf(parseInt(o.id,10)) !== -1; });
      compare_data.push(tmp);
    });

    _.map(compare_data, function (row) {
      _.map(row, function(o){ o.name = o.name.replace(/\+/g,' '); return o; });

      var points = _.reduce(row, function(num,o){ return num + parseInt(o.points,10); }, 0),
          towns = _.reduce(row, function(num,o){ return num + parseInt(o.towns,10); }, 0),
          members = _.reduce(row, function(num,o){ return num + parseInt(o.members,10); }, 0),
          names = _.reduce(row, function(arr,o){ return arr.concat([o.name]); }, []),
          nameStr = names.join('/');

      var total = {
        name: nameStr,
        points: points,
        towns: towns,
        members: members,
        average: {
          points: accounting.formatNumber(points/members),
          towns: accounting.formatNumber(towns/members),
          town_size: accounting.formatNumber(points/towns)
        }
      };

      row.push(total);
      total_data.push(total);

      _.map(row, function(o) {
        o.points = accounting.formatNumber(o.points);
        o.towns = accounting.formatNumber(o.towns);
        return o;
      });

      _.map(total_data, function(o) {
        o.points = accounting.formatNumber(o.points);
        o.towns = accounting.formatNumber(o.towns);
        return o;
      });

      return row;
    });

    utils.getData('us39', 'conquers', function (err, data) {
      if (err) { return; }

      var tmp = _.filter(data, function(o) { return compared_alliances[0].indexOf(parseInt(o.newAlly,10)) !== -1; });
      tmp = _.filter(tmp, function(o) { return compared_alliances[1].indexOf(parseInt(o.oldAlly,10)) !== -1; });

      total_data[0].conquers = tmp.length;
      // conquer_data.push(tmp.length);

      var tmp = _.filter(data, function(o) { return compared_alliances[1].indexOf(parseInt(o.newAlly,10)) !== -1; });
      tmp = _.filter(tmp, function(o) { return compared_alliances[0].indexOf(parseInt(o.oldAlly,10)) !== -1; });

      total_data[1].conquers = tmp.length;
      // conquer_data.push(tmp.length);

      var payload = _.extend(defaults, {alliances: total_data});

      res.render('index', payload);

      payload = null;
      data = null;
      tmp = null;
    });
    data = null;
  });
};