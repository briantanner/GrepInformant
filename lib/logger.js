'use strict';

var winston = require('winston');

require('dotenv').load();
require('winston-loggly');

module.exports = function (options) {
  options = options || {};

  return new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        colorize: true,
        level: options.consoleLevel || 'silly',
        label: options.consoleLabel || null,
        handleExceptions: true,
        humanReadableUnhandledException: true
      }),
      new (winston.transports.Loggly)({
          token: process.env.LOGGLY_TOKEN,
          subdomain: process.env.LOGGLY_SUBDOMAIN,
          tags: options.tags || [],
          level: options.logglyLevel || 'info',
          handleExceptions: true,
          json:true,
      })
    ],
    exitOnError: false
  });
};