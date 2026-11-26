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

SourceBaseConsoleCmd.prototype.set = function(_arguments, _callback) {
   this.checkArguments(2, _arguments);
   this.executeParsedCommand("setProperty", _arguments, _callback);
};

SourceBaseConsoleCmd.prototype.setManualMode = function(_arguments, _callback) {
   return this.executeManualCommand("setManualMode", _arguments, 0, 1, _callback);
};

SourceBaseConsoleCmd.prototype.renewManualOverride = function(_arguments, _callback) {
   return this.executeManualCommand("renewManualOverride", _arguments, 1, 1, _callback);
};

SourceBaseConsoleCmd.prototype.releaseManualOverride = function(_arguments, _callback) {
   return this.executeManualCommand("releaseManualOverride", _arguments, 0, 0, _callback);
};

SourceBaseConsoleCmd.prototype.executeManualCommand = function(_command, _arguments, _min, _max, _callback) {
   var args = _arguments || [];
   var usage = "Usage: " + _command + (_max ? (_min ? " <seconds>" : " [seconds]") : "");
   if (args.length === 1 && (args[0] === "--help" || args[0] === "--usage")) {
      this.console.write(usage);
      return _callback(null, true);
   }
   if (args.length < _min || args.length > _max) return _callback(usage);
   var params = [];
   if (args.length) {
      var duration = (typeof args[0] === "string" || typeof args[0] === "number") ? Number(args[0]) : NaN;
      if (!Number.isFinite(duration) || duration <= 0) return _callback("Duration must be positive finite seconds. " + usage);
      params.push(duration);
   }
   return this.executeParsedCommand(_command, params, _callback);
};

module.exports = exports = SourceBaseConsoleCmd;
