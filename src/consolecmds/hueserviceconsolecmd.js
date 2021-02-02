var ConsoleCmd = require('../consolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args')

function HueServiceConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(HueServiceConsoleCmd, ConsoleCmd);

HueServiceConsoleCmd.prototype.findBridges = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for bridges, this will take 20 seconds...");

   this.executeParsedCommand("findBridges", [], _callback);
};

HueServiceConsoleCmd.prototype.findBridge = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for bridges, this will take 20 seconds...");

   this.executeParsedCommand("findBridge", _arguments, _callback);
};

HueServiceConsoleCmd.prototype.createUserOnBridge = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   var persist = (_arguments.length > 0) ? _arguments[0] : false;

   this.findBridge([], (_err, _bridge) => {

      if (_err) {
         return _callback(_err);
      }

      this.console.write("Found bridge " + _bridge.id + " at IP address " + _bridge.ipaddress);

      this.console.question("Please press the top button on this bridge and confirm by pressing enter...", (_answer)  => {
         this.executeParsedCommand("createUserOnBridge", [ _bridge.ipaddress, persist ], _callback);
      });
   });
};

HueServiceConsoleCmd.prototype.lights = function(_arguments, _callback) {
   this.executeParsedCommand("lights", [], _callback);
};

HueServiceConsoleCmd.prototype.groups = function(_arguments, _callback) {

   if (_arguments && (_arguments.length > 0)) {

      var lightGroupDefinitions = [
         { name: 'groupId', alias: 'l', type: String, defaultOption: true },
         { name: 'create', alias: 'c', type: String }
      ];

      var options = commandLineArgs(lightGroupDefinitions, { argv: _arguments });
      return _callback(options);
   }
   else {
      this.executeParsedCommand("groups", _arguments, _callback);
   }
};

module.exports = exports = HueServiceConsoleCmd;
