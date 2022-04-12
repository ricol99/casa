var ConsoleCmd = require('../consolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');

function BtleServiceConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(BtleServiceConsoleCmd, ConsoleCmd);

// Called when current state required
BtleServiceConsoleCmd.prototype.export = function(_exportObj) {
   ConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
BtleServiceConsoleCmd.prototype.import = function(_importObj) {
   ConsoleCmd.prototype.import.call(this, _importObj);
};

BtleServiceConsoleCmd.prototype.coldStart = function() {
   ConsoleCmd.prototype.coldStart.call(this);
};

BtleServiceConsoleCmd.prototype.hotStart = function() {
   ConsoleCmd.prototype.hotStart.call(this);
};

BtleServiceConsoleCmd.prototype.scan = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for BTLE devices, this will take up to 15 seconds...");

   this.executeParsedCommand("scan", [], _callback);
};

module.exports = exports = BtleServiceConsoleCmd;
