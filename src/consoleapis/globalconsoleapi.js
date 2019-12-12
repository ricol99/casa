var util = require('util');
var ConsoleApi = require('../consoleapi');

function GlobalConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.fullScopeName = "";
   this.myObjuName = "";
}

util.inherits(GlobalConsoleApi, ConsoleApi);

GlobalConsoleApi.prototype.filterScope = function(_scope) {
   var collection = {};
   collection[this.gang.uName] = this.gang;
   return ConsoleApi.prototype.filterScope.call(this, _scope, collection);
};

GlobalConsoleApi.prototype.cat = function() {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].uName);
      }
   }

   return output;
};

GlobalConsoleApi.prototype.sources = function() {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].uName);
   }
   return sources;
};

GlobalConsoleApi.prototype.createThing = function(_uName) {

   if (!this.gang.findObject(_uName)) {
      var thingObj = this.gang.createThing({uName: _uName});
      return true;
   }
   else {
      return false;
   }
};

GlobalConsoleApi.prototype.restart = function() {
   process.exit(3);
};
module.exports = exports = GlobalConsoleApi;
 
