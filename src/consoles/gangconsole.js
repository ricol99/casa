var Console = require('../console');
var util = require('util');

function GangConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.fullScopeName = "";
   this.consoleObjects[this.uName] = this;
}

util.inherits(GangConsole, Console);

GangConsole.prototype.cat = function() {
};

module.exports = exports = GangConsole;
 
