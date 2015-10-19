var version = 0.003;
var crypto = require('crypto');
var fs = require('fs');
require('./console-stamp')(console, '[HH:MM:ss.l]', undefined, { log: false, info: true });

var systemConfigFile = (process.argv.length >= 3) ? process.argv[2] : 'casa-collin-config.json'; 
var configFile = (process.argv.length >= 4) ? process.argv[3] : 'internet-config.json'; 
var connectToPeers = (process.argv.length >= 5) ? process.argv[4] != '-nopeer' : true; 

console.log('System File: ' + systemConfigFile + ' Casa File: ' + configFile);

var config = require('./' + configFile);
var systemConfig = require('./' + systemConfigFile);

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

var system = new System(systemConfig, config, connectToPeers, version);

