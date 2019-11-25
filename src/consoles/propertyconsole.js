var util = require('util');
var Console = require('../console');

function PropertyConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.uName = _config.uName.split(":")[0] + "console:" + _config.uName.split(":")[1] + ":" + _config.uName.split(":")[2];
   this.name = _config.uName.split(":")[2];
   this.fullScopeName = (this.owner && this.owner.fullScopeName !== "") ? this.owner.fullScopeName+":"+this.name : this.myObjuName

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

PropertyConsole.prototype.set = function(_value) {
   return this.owner.setProperty(this.name, _value);
};

PropertyConsole.prototype.watch = function() {
   return this.owner.watch(this.name);
};

PropertyConsole.prototype.unwatch = function() {
   return this.owner.unwatch(this.name);
};

PropertyConsole.prototype.watching = function() {
   return this.owner.getWatchList().hasOwnProperty(this.name);
};

PropertyConsole.prototype.listeners = function() {
   return this.owner.listeners(this.name);
};

module.exports = exports = PropertyConsole;
 
