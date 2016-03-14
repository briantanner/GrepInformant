'use strict';

const fs = require('fs');
const path = require('path');
const urlencode = require('urlencode');

class Utils {

  // returns files within a directory and subdirectories
  readdirRecursive(dir) {
    return new Promise(resolve => {
      let list = [],
          files = fs.readdirSync(dir),
          stats;

      files.forEach(file => {
        stats = fs.lstatSync(path.join(dir, file));

        if (stats.isDirectory()) {

          this.readdirRecursive(path.join(dir, file))
            .then(files => {
              list = list.concat(files);
            });

        } else {
          list.push(path.join(dir, file));
        }
      });

      return resolve(list);
    });
  }

  sanitizeName(name) {
    return urlencode.decode(name).replace(/\+/g, ' ').replace(/\'/g, "''");
  }
}

module.exports = new Utils();
