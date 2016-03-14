'use strict';

const chai = require('chai');
const request = require('request');

let expect = chai.expect,
    url = 'http://localhost:8080/us50/';

// /:server/alliances
// /:server/alliance/:alliance
// /:server/allianceActivity/:alliance
// /:server/allianceConquers/:alliance
// /:server/allianceLosses/:alliance

describe('Web and API Tests', () => {

  describe('Alliances', () => {
    let _url = url + 'alliances';

    it('returns status 200', done => {
      return request(_url, (err, res, body) => {
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

  describe('Alliance', () => {
    let _url = url + 'alliance/191';

    it('returns status 200', done => {
      return request(_url, (err, res, body) => {
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

  describe('Alliances Activity', () => {
    let _url = url + 'allianceActivity/191';

    it('returns status 200', done => {
      return request(_url, (err, res, body) => {
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

  describe('Alliance Conquers', () => {
    let _url = url + 'allianceConquers/191';

    it('returns status 200', done => {
      return request(_url, (err, res, body) => {
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

  describe('Alliance Losses', () => {
    let _url = url + 'allianceLosses/191';

    it('returns status 200', done => {
      return request(_url, (err, res, body) => {
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });

});