var version = 1.024;
var crypto = require('crypto');
var fs = require('fs');
var commandLineArgs = require('command-line-args')
 
var optionDefinitions = [
  { name: 'system', alias: 's', type: String },
  { name: 'local', alias: 'l', type: String, defaultOption: true },
  { name: 'secure', type: Boolean },
  { name: 'certs', type: String },
  { name: 'config', type: String },
  { name: 'nopeer', type: Boolean }
]

var options = commandLineArgs(optionDefinitions)

if (options.local == undefined) {
   console.log("Usage: casa [--system|-s <SYSTEM.json>] [--secure] [--nopeer] <LOCAL>.json");
   process.exit(1);
}

require('./console-stamp')(console, '[HH:MM:ss.l]', undefined, { log: true, info: true, error: true });

var systemConfigFile = (options.system == undefined) ? 'casa-collin-config.json' : options.system;
var connectToPeers = (options.nopeer == undefined) ? true : !options.nopeer;
var secureMode = (options.secure == undefined) ? false : options.secure;
var certPath = (options.certs == undefined) ? process.env['HOME']+'/.casa-keys' : './'+options.certs;
var configPath = (options.config == undefined) ? process.env['HOME']+'/.casa-keys/secure-configs' : options.config;
var configFile = options.local;

console.log('System File: ' + systemConfigFile + ' Casa File: ' + configFile);

var config = require('./' + configFile);
var systemConfig = require('./' + systemConfigFile);

if (config.name == 'internet' && !config.id) {
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
         throw err;
      }
      config.id = id;
  }
} 

System = require('./casasystem');

var system = new System(systemConfig, config, connectToPeers, secureMode, certPath, configPath, version);

