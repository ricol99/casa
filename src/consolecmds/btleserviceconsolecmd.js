var ConsoleCmd = require('../consolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');

function BtleServiceConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(BtleServiceConsoleCmd, ConsoleCmd);

BtleServiceConsoleCmd.prototype.scan = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for BTLE devices, this will take up to 15 seconds...");

   this.executeParsedCommand("scan", [], _callback);
};

module.exports = exports = BtleServiceConsoleCmd;
