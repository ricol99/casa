var ConsoleCmd = require('../consolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');

function SourceBaseConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(SourceBaseConsoleCmd, ConsoleCmd);

// Called when current state required
SourceBaseConsoleCmd.prototype.export = function(_exportObj) {
   ConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
SourceBaseConsoleCmd.prototype.import = function(_importObj) {
   ConsoleCmd.prototype.import.call(this, _importObj);
};

SourceBaseConsoleCmd.prototype.coldStart = function() {
   ConsoleCmd.prototype.coldStart.call(this);
};

SourceBaseConsoleCmd.prototype.hotStart = function() {
   ConsoleCmd.prototype.hotStart.call(this);
};

SourceBaseConsoleCmd.prototype.exportData = function(_arguments, _callback)  {
   this.executeParsedCommand("export", _arguments, _callback);
};

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

SourceBaseConsoleCmd.prototype.resolve = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("resolve", [], _callback);
};

SourceBaseConsoleCmd.prototype.explain = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("explain", [], _callback);
};

SourceBaseConsoleCmd.prototype.usage = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   var definitions = [
      { name: 'activeOnly', alias: 'a', type: Boolean },
      { name: 'hasConsumers', alias: 'h', type: Boolean }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments ? _arguments : [], stopAtFirstUnknown: true });
   }
   catch (_err) {
      return _callback(_err.message ? _err.message : "Unable to parse command arguments");
   }

   if (options._unknown && options._unknown.length > 0) {
      return _callback("Too many arguments. Usage: usage [--activeOnly] [--hasConsumers]");
   }

   this.executeParsedCommand("usage", [ { activeOnly: !!options.activeOnly, hasConsumers: !!options.hasConsumers } ], _callback);
};

module.exports = exports = SourceBaseConsoleCmd;
