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
  { name: 'settle', type: String },
  { name: 'port', type: Number },
  { name: 'crash', type: String },
]

var options = commandLineArgs(optionDefinitions)

var connectToPeers = (options.nopeer == undefined) ? true : !options.nopeer;
var secureMode = (options.secure == undefined) ? false : options.secure;
var certPath = (options.certs == undefined) ? process.env['HOME']+'/.casa-keys' : util.checkPath(options.certs);
var configPath = (options.config == undefined) ? process.env['HOME']+'/.casa-keys/secure-config' : util.checkPath(options.config);
var casaName = options.casa;
var logEvents = options.logevents;
var settleTime = options.settle;
var listeningPort = options.port;
var crash = options.crash;

if ((listeningPort !== undefined) &&
    (!Number.isInteger(listeningPort) || (listeningPort <= 0) || (listeningPort > 65535))) {
   console.log("Usage: casa [--secure] [--certs dir] [--config dir] [--nopeer] [--localconsole | --console] [--settle settle-time-secs] [--port port] [--crash delay(s)] <casa-or-gang-name>");
   process.exit(1);
}

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

if ((options.casa == undefined) && consoleRequired) {
   console.log("Usage: casa [--secure] [--certs dir] [--config dir] [--nopeer] [--localconsole | --console] [--settle settle-time-secs] [--port port] [--crash delay(s)] <casa-or-gang-name>");
   process.exit(1);
}

Loader = require('./loader');
var loader = new Loader(casaName, connectToPeers, secureMode, certPath, configPath, version, consoleRequired, logEvents, settleTime, crash, listeningPort);
loader.load();
