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

module.exports = exports = CasaConsoleCmd;
 
