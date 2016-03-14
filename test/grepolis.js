'use strict';

const chai = require('chai');

let should = chai.should(),
    grepolis = require('../lib/grepolis'),
    server = 'us50';

describe("Get players from grepolis", () => {
  it('returns an array of objects', () => {
    return grepolis.getPlayers(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});

describe("Get player stats from grepolis", () => {
  it('returns an object', () => {
    return grepolis.getPlayerStats(server, 'abp')
      .then(data => {
        data.should.be.a('object');
      });
  });
});

describe("Get full players from grepolis", () => {
  it('returns an object', () => {
    return grepolis.getPlayersFull(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});

describe("Get alliances from grepolis", () => {
  it('returns an array of object', () => {
    return grepolis.getAlliances(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});

describe("Get alliance stats from grepolis", () => {
  it('returns an object', () => {
    return grepolis.getAllianceStats(server, 'abp')
      .then(data => {
        data.should.be.a('object');
      });
  });
});

describe("Get full alliances from grepolis", () => {
  it('returns an array of objects', () => {
    return grepolis.getAlliancesFull(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});

describe("Get towns from grepolis", () => {
  it('returns an array of object', () => {
    return grepolis.getTowns(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});

describe("Get islands from grepolis", () => {
  it('returns an array of object', () => {
    return grepolis.getIslands(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});

describe("Get conquers from grepolis", () => {
  it('returns an array of object', () => {
    return grepolis.getConquers(server)
      .then(data => {
        data.should.be.a('array');
        data.should.have.length.of.at.least(2);
        data[0].should.be.a('object');
      });
  });
});
