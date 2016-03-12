'use strict';

var _ = require('underscore'),
    util = require('util'),
    Data = require('./model');

exports.all = function (req, res, next) {
  Data.worlds(function (err, result) {
    if (err) return res.send(500, err);
    res.locals.worlds = result;
  });

  next();
};

exports.server = function (req, res, next) {
  // console.log(req.app.locals)
  res.app.locals({
    server: req.params.server
  });
  // console.log(res.app.locals.server)
  next();
};