var util = require('util');

function ConsoleCmd(_config, _console) {
   this.config = _config;
   this.type = "consolecmd";
   this.uName = _config.uName.split(":")[0] + "consolecmd:" + _config.uName.split(":")[1];
   this.console = _console;
}

ConsoleCmd.prototype.coldStart = function() {
};


module.exports = exports = ConsoleCmd;
