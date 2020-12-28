var ConsoleCmd = require('../consolecmd');
var util = require('util');

function HueServiceConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(HueServiceConsoleCmd, ConsoleCmd);

HueServiceConsoleCmd.prototype.findBridges = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for bridges, this will take 20 seconds...");

   this.console.executeParsedCommand(_obj, "findBridges", [], _callback);
};

HueServiceConsoleCmd.prototype.findBridge = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for bridges, this will take 20 seconds...");

   this.console.executeParsedCommand(_obj, "findBridge", _arguments, _callback);
};

HueServiceConsoleCmd.prototype.createUserOnBridge = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   var persist = (_arguments.length > 0) ? _arguments[0] : false;

   this.findBridge(_obj, [], (_err, _bridge) => {

      if (_err) {
         return _callback(_err);
      }

      this.console.write("Found bridge " + _bridge.id + " at IP address " + _bridge.ipaddress);

      this.console.question("Please press the top button on this bridge and confirm by pressing enter...", (_answer)  => {
         this.console.executeParsedCommand(_obj, "createUserOnBridge", [ _bridge.ipaddress, persist ], _callback);
      });
   });
};

module.exports = exports = HueServiceConsoleCmd;
