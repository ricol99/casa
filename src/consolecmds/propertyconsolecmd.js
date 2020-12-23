var ConsoleCmd = require('../consolecmd');
var util = require('util');

function PropertyConsoleCmd(_config, _console) {
   ConsoleCmd.call(this, _config, _console);
}

util.inherits(PropertyConsoleCmd, ConsoleCmd);

module.exports = exports = PropertyConsoleCmd;
