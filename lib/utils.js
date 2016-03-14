'use strict';

const fs = require('fs');
const path = require('path');
const urlencode = require('urlencode');

let count = 1;

class Utils {

  // returns files within a directory and subdirectories
  readdirRecursive(dir, callback) {
    let list = [],
        files = fs.readdirSync(dir),
        dirs,
        stats;

    let isDir = (fname) => {
      return fs.existsSync(path.join(dir, fname)) ? fs.statSync(path.join(dir, fname)).isDirectory() : false;
    }

    dirs = files.filter(isDir);
    
    files = files.filter(file => { return !isDir(file); });
    files = files.map(file => { return path.join(dir, file); });

    list = list.concat(files);

    while (dirs.length) {
      let d = path.join(dir, dirs.shift());
      list = list.concat( this.readdirRecursive( d ) );
    }

    return (callback) ? callback(list) : list;
  }

  sanitizeName(name) {
    return urlencode.decode(name).replace(/\+/g, ' ').replace(/\'/g, "''");
  }
}

module.exports = new Utils();
