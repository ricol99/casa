var ConsoleCmd = require('../consolecmd');
var util = require('util');

function CasaConsoleCmd(_config, _console) {
   ConsoleCmd.call(this, _config, _console);
}

util.inherits(CasaConsoleCmd, ConsoleCmd);

CasaConsoleCmd.prototype.fetchDbs = function(_obj, _arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   this.console.executeParsedCommand(_obj, "fetchDbs", [ myAddress, port], _callback);
};

CasaConsoleCmd.prototype.fetchDb = function(_obj, _arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   this.console.executeParsedCommand(_obj, "fetchDb", [ myAddress, port], _callback);
};

CasaConsoleCmd.prototype.exportDb = function(_obj, _arguments, _callback) {

   this.console.executeParsedCommand(_obj, "exportDb", null, (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }
     
      Db = require('../db');
      var output = Db.export(_result);
      var fileName = this.gang.configPath() + "/configs/" + this.myObjuName + ".json";
      var fs = require('fs');
      var content = JSON.stringify(output, null, 3);

      fs.writeFile(fileName, content, (_err) => {
         _callback(_err, true);
      });
   });
};

module.exports = exports = CasaConsoleCmd;
 
