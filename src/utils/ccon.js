var crypto = require('crypto');
var commandLineArgs = require('command-line-args')
var util = require('util');

var optionDefinitions = [
  { name: 'gangCasa', alias: 'g', type: String, multiple: true, defaultOption: true },
  { name: 'secure', type: Boolean },
  { name: 'certs', type: String },
  { name: 'config', type: String }
]

var options = commandLineArgs(optionDefinitions)

if (!options.hasOwnProperty("gangCasa") || options.gangCasa.length === 0) {
   console.log("Usage: ccon [--secure] [--certs] [--config] <gang-name> [<casa-name>]");
   process.exit(1);
}

var secureMode = (options.secure == undefined) ? false : options.secure;
var certPath = (options.certs == undefined) ? process.env['HOME']+'/.casa-keys' : checkPath(options.certs);
var configPath = (options.config == undefined) ? process.env['HOME']+'/.casa-keys/secure-config' : checkPath(options.config);
var gang = options.gangCasa[0];
var casa = (options.gangCasa.length > 1) ? options.gangCasa[1] : null;

function checkPath(_path) {
   return (_path) ? (((_path.charAt(0) !== '.') && (_path.charAt(0) !== '/')) ? "./" + _path : _path) : _path;
}

var CasaFinder = require('../casafinder');
var casaFinder = new CasaFinder({ gang: gang, casa: casa });
casaFinder.coldStart();
var RemoteConsole = require('../remoteconsole');
var remoteConsole;

var callFinderListener = function(_params) {
   casaFinder.removeListener("casa-found", callFinderListener);
   _params.secureMode = secureMode;
   _params.certPath = certPath;
   remoteConsole = new RemoteConsole(_params);
}

casaFinder.on("casa-found", callFinderListener);

