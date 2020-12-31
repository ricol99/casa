var ConsoleCmd = require('../consolecmd');
var util = require('util');

function SourceBaseConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(SourceBaseConsoleCmd, ConsoleCmd);

SourceBaseConsoleCmd.prototype.watch = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   this.executeParsedCommand("watch", _arguments, _callback);
};

SourceBaseConsoleCmd.prototype.unwatch = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   this.executeParsedCommand("unwatch", _arguments, _callback);
};

SourceBaseConsoleCmd.prototype.watching = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("watching", [], _callback);
};

module.exports = exports = SourceBaseConsoleCmd;
