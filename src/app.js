var version = 1.047;
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
  { name: 'nopeer', type: Boolean }
]

var options = commandLineArgs(optionDefinitions)

if (options.casa == undefined) {
   console.log("Usage: casa [--secure] [--certs] [--config] [--nopeer] [--localconsole | --console] <casa-or-gang-name>");
   process.exit(1);
}


var connectToPeers = (options.nopeer == undefined) ? true : !options.nopeer;
var secureMode = (options.secure == undefined) ? false : options.secure;
var certPath = (options.certs == undefined) ? process.env['HOME']+'/.casa-keys' : checkPath(options.certs);
var configPath = (options.config == undefined) ? process.env['HOME']+'/.casa-keys/secure-config' : checkPath(options.config);
var casaName = options.casa;

var logs;
if (options.localconsole || options.console) {
   logs = { };
}
else {
   logs = (options.logs == undefined) ? { log: true, info: true, error: true} : { log: (options.logs == "log"), info: ((options.logs == "info") || (options.logs == "log")), error: true };
}

require('./console-stamp')(console, '[HH:MM:ss.l]', undefined, logs);

var consoleRequired = (options.console) ? "global" : (options.localconsole) ? "local" : false;

Gang = require('./gang');
var gang = new Gang(casaName, connectToPeers, secureMode, certPath, configPath, version, consoleRequired);

function checkPath(_path) {
   return (_path) ? (((_path.charAt(0) !== '.') && (_path.charAt(0) !== '/')) ? "./" + _path : _path) : _path;
}

