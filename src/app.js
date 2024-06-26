var version = 1.047;
var util = require('./util');
var crypto = require('crypto');
var commandLineArgs = require('command-line-args')
 
var optionDefinitions = [
  { name: 'casa', alias: 'c', type: String, defaultOption: true },
  { name: 'secure', type: Boolean },
  { name: 'certs', type: String },
  { name: 'config', type: String },
  { name: 'localconsole', type: Boolean },
  { name: 'console', type: Boolean },
  { name: 'logs', type: String },
  { name: 'nopeer', type: Boolean },
  { name: 'logevents', type: Boolean },
  { name: 'crash', type: String },
]

var options = commandLineArgs(optionDefinitions)

if (options.casa == undefined) {
   console.log("Usage: casa [--secure] [--certs dir] [--config dir] [--nopeer] [--localconsole | --console] [--crash delay(s)] <casa-or-gang-name>");
   process.exit(1);
}


var connectToPeers = (options.nopeer == undefined) ? true : !options.nopeer;
var secureMode = (options.secure == undefined) ? false : options.secure;
var certPath = (options.certs == undefined) ? process.env['HOME']+'/.casa-keys' : util.checkPath(options.certs);
var configPath = (options.config == undefined) ? process.env['HOME']+'/.casa-keys/secure-config' : util.checkPath(options.config);
var casaName = options.casa;
var logEvents = options.logevents;
var crash = options.crash;

var logs;
if (options.localconsole || options.console) {
   logs = { };
   logEvents = false;
}
else {
   logs = (options.logs == undefined) ? { log: true, info: true, error: true} : { log: (options.logs == "log"), info: ((options.logs == "info") || (options.logs == "log")), error: true };
}

require('./console-stamp')(console, '[HH:MM:ss.l]', undefined, logs);

var consoleRequired = (options.console) ? "global" : (options.localconsole) ? "local" : false;

Loader = require('./loader');
var loader = new Loader(casaName, connectToPeers, secureMode, certPath, configPath, version, consoleRequired, logEvents, crash);
loader.load();

