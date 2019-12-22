var ConsoleCmd = require('../consolecmd');
var util = require('util');

function GangConsoleCmd(_config, _console) {
   ConsoleCmd.call(this, _config, _console);
}

util.inherits(GangConsoleCmd, ConsoleCmd);

GangConsoleCmd.prototype.restart = function(_line, _parseResult, _callback)  {
   this.console.sendCommandToAllCasas(_line, "executeCommand", _callback);
};

GangConsoleCmd.prototype.fetchDbs = function(_line, _parseResult, _callback) {
   var line = _line.split("(")[0];

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   line = line + "(\"" + myAddress + "\", " + port +")";
   this.console.sendCommandToAllCasas(line, "executeCommand", _callback);
};

GangConsoleCmd.prototype.fetchDb = function(_line, _parseResult, _callback) {
   var line = _line.split("(")[0];

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   line = line + "(\"" + myAddress + "\", " + port +")";
   this.console.sendCommandToAllCasas(line, "executeCommand", _callback);
};

module.exports = exports = GangConsoleCmd;
 
