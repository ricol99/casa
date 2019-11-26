var util = require('util');
var SourceBaseConsole = require('./sourcebaseconsole');
var Console = require('../console');

function SourceConsole(_config, _owner) {
   SourceBaseConsole.call(this, _config, _owner);
}

util.inherits(SourceConsole, SourceBaseConsole);

SourceConsole.prototype.setProperty = function(_property, _value) {
   return this.myObj().setProperty(_property, _value, {});
};

SourceConsole.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = SourceConsole;
 
