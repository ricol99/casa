var crypto = require('crypto');
var commandLineArgs = require('command-line-args')
var util = require('util');

var optionDefinitions = [
  { name: 'gangCasa', alias: 'g', type: String, multiple: true, defaultOption: true },
  { name: 'secure', type: Boolean },
  { name: 'certs', type: String },
  { name: 'logs', type: String },
  { name: 'config', type: String }
]

var options = commandLineArgs(optionDefinitions)

if (!options.hasOwnProperty("gangCasa") || options.gangCasa.length === 0) {
   console.log("Usage: ccon [--secure] [--certs] [--config] [--logs <mask>] <gang-name> [<casa-name>]");
   process.exit(1);
}

var secureMode = (options.secure == undefined) ? false : options.secure;
var certPath = (options.certs == undefined) ? process.env['HOME']+'/.casa-keys' : checkPath(options.certs);
var configPath = (options.config == undefined) ? process.env['HOME']+'/.casa-keys/secure-config' : checkPath(options.config);
var gang = options.gangCasa[0];
var casa = (options.gangCasa.length > 1) ? options.gangCasa[1] : null;

var logs;
if (!options.logs) {
   logs = { };
}
else {
   logs = { log: (options.logs == "log"), info: ((options.logs == "info") || (options.logs == "log")), error: true };
}

function checkPath(_path) {
   return (_path) ? (((_path.charAt(0) !== '.') && (_path.charAt(0) !== '/')) ? "./" + _path : _path) : _path;
}

var Console = require('../console');
var console = new Console({ gangName: gang, casaName: casa, secureMode: secureMode, certPath: certPath });
console.coldStart();

