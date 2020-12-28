var ConsoleCmd = require('../consolecmd');
var util = require('util');

function PropertyConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(PropertyConsoleCmd, ConsoleCmd);

PropertyConsoleCmd.prototype.watch = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.executeParsedCommand(_obj, "watch", _arguments, _callback);
};

PropertyConsoleCmd.prototype.unwatch = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.executeParsedCommand(_obj, "unwatch", _arguments, _callback);
};

PropertyConsoleCmd.prototype.watching = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.executeParsedCommand(_obj, "watching", [], _callback);
};

module.exports = exports = PropertyConsoleCmd;
