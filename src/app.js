var crypto = require('crypto');
var fs = require('fs');
require('console-stamp')(console, '[HH:MM:ss.l]');

var configFile = (process.argv.length >= 3) ? process.argv[2] : 'internet-config.json'; 

console.log('File: ' + configFile);
var config = require('./' + configFile);

if (config.name == 'casa:internet' && !config.id) {
   config.id = '0000001';
}

if (!config.id) {
   var idFilename = './.' + config.name + 'ID.json';

   try {
      uniqueId = require(idFilename);
      config.id = uniqueId.id;
   }
   catch (ex) {
      // Generate id and write to file
      var id = crypto.randomBytes(16).toString('hex');
      if (err=fs.writeFileSync(idFilename, JSON.stringify({id: id}))) {
         console.log('Cannot write ID file!');
         throw err
      }
      config.id = id;
  }
} 

System = require('./casasystem');

var system = new System(config);

