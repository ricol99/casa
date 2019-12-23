var ConsoleCmd = require('../consolecmd');
var util = require('util');

function CasaConsoleCmd(_config, _console) {
   ConsoleCmd.call(this, _config, _console);
}

util.inherits(CasaConsoleCmd, ConsoleCmd);

CasaConsoleCmd.prototype.fetchDbs = function(_line, _parseResult, _callback) {
   var line = _line.split("(")[0];

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   line = line + "(\"" + myAddress + "\", " + port +")";
   this.console.identifyCasaAndSendCommand(line, "executeCommand", _callback);
};

CasaConsoleCmd.prototype.fetchDb = function(_line, _parseResult, _callback) {
   var line = _line.split("(")[0];

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   line = line + "(\"" + myAddress + "\", " + port +")";
   this.console.identifyCasaAndSendCommand(line, "executeCommand", _callback);
};

CasaConsoleCmd.prototype.exportDb = function(_line, _parseResult, _callback) {

   this.console.identifyCasaAndSendCommand(_line, "executeCommand", (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }
     
      Db = require('../db');
      var output = Db.export(_result);
      var fileName = this.gang.configPath() + "/exports/" + this.myObjuName + ".json";
      var fs = require('fs');
      var content = JSON.stringify(output, null, 3);

      fs.writeFile(fileName, content, (_err) => {
         _callback(_err, true);
      });
   });
};

module.exports = exports = CasaConsoleCmd;
 
