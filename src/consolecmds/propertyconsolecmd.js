var ConsoleCmd = require('../consolecmd');
var util = require('util');

function PropertyConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(PropertyConsoleCmd, ConsoleCmd);

PropertyConsoleCmd.prototype.set = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   this.executeParsedCommand("set", _arguments, _callback);
};

PropertyConsoleCmd.prototype.watch = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("watch", [], _callback);
};

PropertyConsoleCmd.prototype.unwatch = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("unwatch", [], _callback);
};

PropertyConsoleCmd.prototype.watching = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("watching", [], _callback);
};

PropertyConsoleCmd.prototype.listeners = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("listeners", [], _callback);
};

module.exports = exports = PropertyConsoleCmd;
