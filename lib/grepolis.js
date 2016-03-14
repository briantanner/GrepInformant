'use strict';

const _ = require('underscore');
const http = require('http');
const util = require('util');
const zlib = require('zlib');
const async = require('async');
const moment = require('moment');
const urlencode = require('urlencode');
const accounting = require('accounting');

let Promise = require('bluebird'),
    url = "http://%s.grepolis.com/data/%s.txt.gz",
    logger = require('./logger')({
      consoleLabel: 'grepolis',
      tags: ['grepolis']
    });

let keys = {
  towns              : "id,player,name,x,y,islandNo,points",
  players            : "id,name,alliance,points,rank,towns",
  islands            : "id,x,y,type,availableSpots,plus,minus",
  conquers           : "town,time,newPlayer,oldPlayer,newAlly,oldAlly,points",
  alliances          : "id,name,points,towns,members,rank",
  player_kills_all   : "rank,id,points",
  player_kills_att   : "rank,id,points",
  player_kills_def   : "rank,id,points",
  alliance_kills_all : "rank,id,points",
  alliance_kills_att : "rank,id,points",
  alliance_kills_def : "rank,id,points",
  island_offsets     : "id,offsetx,offsety,pos"
};

class Grepolis {

  // urldecode names
  parseName(name) {
    return urlencode.decode(name).replace(/\+/g, ' ');
  }

  // parse the data from csv
  parseData(server, endpoint, data) {
    let dataArray = [],
        lines = data.split("\n"),
        _keys = keys[endpoint].split(',');

    _keys.push('server');

    lines = lines.filter(val => {
      if (!val.length) {
        return false;
      }
      return true;
    });

    lines = lines.map(row => {
      row = row.split(',');
      row.push(server);

      return _.object(_keys, row);
    });

    return lines;
  }

  // get data files from grepolis
  getData(server, endpoint) {

    return new Promise((resolve, reject) => {
      let _url = util.format(url, server, endpoint);

      // get data from url
      http.get(_url, res => {
        if (res.headers['content-type'] !== 'application/octet-stream') {
          return resolve({});
        }

        let gunzip = zlib.createUnzip(),
            output = "";

        res.pipe(gunzip);

        gunzip.on('data', data => {
          output += data.toString();
        });

        gunzip.on('end', () => {
          let response = {};
          
          response.data = this.parseData(server, endpoint, output);
          response.content_length = res.headers['content-length'];

          return resolve(response);
        });
      }).on('error', e => {
        return reject(e);
      });
    });
  }

  // get players
  getPlayers(server) {
    return new Promise((resolve, reject) => {

      this.getData(server, 'players')
        .then(results => {
          results.data = _.map(results.data, o => {
            o.name = this.parseName(o.name);
            return o;
          });

          results.data = _.sortBy(results.data, o => {
            return parseInt(o.rank, 10);
          });
          
          return resolve(results.data);
        })
        .catch(reject);

    });
  }

  // get player stats
  getPlayerStats(server, stat) {
    return new Promise((resolve, reject) => {
      this.getData(server, stat)
        .then(results => {
          let players = {};

          _.each(results.data, o => {
            players[o.id] = o;
          });

          return resolve(players);
        })
        .catch(reject);
    });
  }

  // method to wrap players and stats
  getPlayersFull(server) {
    return new Promise((resolve, reject) => {
      Promise.join(
        this.getPlayerStats(server, 'player_kills_att'),
        this.getPlayerStats(server, 'player_kills_def'),
        this.getPlayers(server),
        (abp, dbp, players) => {
          // add abp/dbp to players and parse data
          players = _.map(players, o => {
            o.abp = (abp[o.id]) ? parseInt(abp[o.id].points,10) : 0;
            o.dbp = (dbp[o.id]) ? parseInt(dbp[o.id].points,10) : 0;
            o.alliance = o.alliance ? parseInt(o.alliance, 10) : 0;
            return o;
          });

          return players;
        })
        .then(players => {
          return resolve(players);
        }, err => {
          logger.error(err);
          return reject(err);
        });
    });
  }

  // get alliances
  getAlliances(server) {
    return new Promise((resolve, reject) => {

      this.getData(server, 'alliances')
        .then(results => {
          let alliances = results.data;

          alliances = _.map(alliances, o => {
            o.name = this.parseName(o.name);
            return o;
          });

          alliances = _.sortBy(alliances, o => { return parseInt(o.rank, 10); });

          return resolve(alliances);
        })
        .catch(reject);
    });
  }

  // get alliance stats
  getAllianceStats(server, stat) {
    return new Promise((resolve, reject) => {

      this.getData(server, stat)
        .then(results => {
          let alliances = {};

          _.each(results.data, o => {
            alliances[o.id] = o;
          });

          return resolve(alliances);
        })
        .catch(reject);
    });
  }

  // method to wrap alliances and stats
  getAlliancesFull(server) {
    return new Promise((resolve, reject) => {
      Promise.join(
        this.getAllianceStats(server, 'alliance_kills_att'),
        this.getAllianceStats(server, 'alliance_kills_def'),
        this.getAlliances(server),
        (abp, dbp, alliances) => {
          alliances = _.map(alliances, o => {
            o.abp = parseInt(abp[o.id].points,10);
            o.dbp = parseInt(dbp[o.id].points,10);
            return o;
          });

          return resolve(alliances);
        })
        .then(alliances => {
          return resolve(alliances);
        }, err => {
          logger.error(err);
          return reject(err);
        });
    });
  }

  // get towns
  getTowns(server) {
    return new Promise((resolve, reject) => {

      this.getData(server, 'towns')
        .then(results => {
          let towns = results.data;

          towns = towns.map(o => {
            o.name = this.parseName(o.name);
            o.player = (o.player && o.player.length) ? parseInt(o.player, 10) : 0;
            return o;
          });

          return resolve(towns);
        })
        .catch(reject);
    });
  }

  // get islands
  getIslands(server) {
    return new Promise((resolve, reject) => {

      this.getData(server, 'islands')
        .then(results => {
          let islands = results.data;
          return resolve(islands);
        })
        .catch(reject);
    });
  }

  // get conquers
  getConquers(server) {
    return new Promise((resolve, reject) => {
    
      this.getData(server, 'conquers')
        .then(results => {
          let conquers = results.data;

          conquers = _.map(conquers, o => {
            o.newPlayer = (o.newPlayer && o.newPlayer.length) ? parseInt(o.newPlayer, 10) : 0;
            o.oldPlayer = (o.oldPlayer && o.oldPlayer.length) ? parseInt(o.oldPlayer, 10) : 0;
            o.newAlly = (o.newAlly && o.newAlly.length) ? parseInt(o.newAlly, 10) : 0;
            o.oldAlly = (o.oldAlly && o.oldAlly.length) ? parseInt(o.oldAlly, 10) : 0;

            return o;
          });

          return resolve(conquers);
        })
        .catch(reject);
    });
  }
}

module.exports = new Grepolis();
