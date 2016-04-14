'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');

// load .env file if exists
if (fs.existsSync(path.join(process.env.PWD, '.env'))) {
  require('dotenv').load();
}

require('winston-loggly');

class Logger {

  constructor(options) {
    let disableLoggly = process.env.DISABLE_LOGGLY || false;
    
    let logger = new (winston.Logger)({
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          level: options.consoleLevel || 'silly',
          label: options.consoleLabel || null,
          handleExceptions: true,
          humanReadableUnhandledException: true
        }),
        new (winston.transports.Loggly)({ // Loggly transport
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

    if (disableLoggly) {
      logger.debug('Loggly disabled in env.');
      logger.remove(winston.transports.Loggly);
    }

    return logger;
  }
}

module.exports = function (options) {
  return new Logger(options);
};
