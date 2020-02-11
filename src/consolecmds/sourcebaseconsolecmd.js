var ConsoleCmd = require('../consolecmd');
var util = require('util');

function SourceBaseConsoleCmd(_config, _console) {
   ConsoleCmd.call(this, _config, _console);
}

util.inherits(SourceBaseConsoleCmd, ConsoleCmd);

SourceBaseConsoleCmd.prototype.watch = function(_obj, _arguments, _callback) {
   this.checkArguments(1, _arguments);
   this.console.executeParsedCommand(_obj, "watch", _arguments, _callback);
};

SourceBaseConsoleCmd.prototype.unwatch = function(_obj, _arguments, _callback) {
   this.checkArguments(1, _arguments);
   this.console.executeParsedCommand(_obj, "unwatch", _arguments, _callback);
};

SourceBaseConsoleCmd.prototype.watching = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.executeParsedCommand(_obj, "watching", [], _callback);
};

module.exports = exports = SourceBaseConsoleCmd;
