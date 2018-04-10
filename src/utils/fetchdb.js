var commandLineArgs = require('command-line-args')

var optionDefinitions = [
  { name: 'casa', type: String, defaultOption: true },
  { name: 'host', alias: 'h', type: String },
  { name: 'port', alias: 'p', type: String },
  { name: 'certs', alias: 'c', type: String },
  { name: 'secure', alias: 's', type: Boolean },
  { name: 'output', alias: 'o', type: String }
]

var options = commandLineArgs(optionDefinitions)

if ((options.casa == undefined) || (options.host == undefined)) {
   console.log("Usage: fetchdb --host <hostname> [--port <port>] [--secure] [--certs <cert-dir>] [--output <output-db-dir] <casa-db-name>");
   process.exit(1);
}

var secure = (options.secure != undefined); 
var certPath = (options.certs == undefined) ? ((secure) ? process.env['HOME']+'/.casa-keys' : undefined) : options.certs;

if (certPath) {
   secure = true;
}

var host = options.host;
var port = (options.port != undefined) ? options.port : ((secure) ? 443 : 80); 
var casaName = options.casa;
var outputPath = options.output;

function Gang() {
}

Gang.prototype.inSecureMode = function() {
   return secure;
};

Gang.prototype.certPath = function() {
   return certPath;
};

Gang.prototype.mainListeningPort = function() {
   return 8000; 
};

var util = require('../util');
var DbService = require('../services/dbservice');
DbService.setGang(new Gang());

dbService = new DbService({});

dbService.getAndWritePeerDb(casaName, host, port, outputPath, (_err, _res) => {

   if (_err) {
      console.error("Unable to fetch DB. Error: "+ _err);
      process.exit(2);
   }
});



