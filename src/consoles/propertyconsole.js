var util = require('util');
var Console = require('../console');

function PropertyConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.uName = _config.uName;
   this.name = _config.uName.split(":")[2];
}

util.inherits(PropertyConsole, Console);

PropertyConsole.prototype.myObj = function() {
   var myObj = this.owner.myObj();
   return (myObj) ? myObj.props[this.name] : null;
};

PropertyConsole.prototype.cat = function() {
   return this.myObj().getValue();
};

PropertyConsole.prototype.getValue = function() {
   return this.myObj().getValue();
};

PropertyConsole.prototype.watch = function() {
   return this.owner.watch(this.name);
};

PropertyConsole.prototype.unwatch = function() {
   return this.owner.unwatch(this.name);
};

PropertyConsole.prototype.watching = function() {
   return this.owner.watchList.hasOwnProperty(this.name);
};

module.exports = exports = PropertyConsole;
 
