var ConsoleCmd = require('../consolecmd');
var util = require('util');

function SourceConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(SourceConsoleCmd, ConsoleCmd);

SourceConsoleCmd.prototype.set = function(_arguments, _callback) {
   this.checkArguments(2, _arguments);
   this.executeParsedCommand("setProperty", _arguments, _callback);
};

SourceConsoleCmd.prototype.events = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("events", _arguments, _callback);
};

module.exports = exports = SourceConsoleCmd;
