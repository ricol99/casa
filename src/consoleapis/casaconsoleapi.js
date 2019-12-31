var util = require('util');
var ConsoleApi = require('../consoleapi');

function CasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.dbService =  this.gang.casa.findService("dbservice");
}

util.inherits(CasaConsoleApi, ConsoleApi);

CasaConsoleApi.prototype.filterScope = function(_scope) {
   var result = ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().sources);
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.gang.casa.services, result);
};

CasaConsoleApi.prototype.cat = function() {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].uName);
      }
   }

   return output;
};

CasaConsoleApi.prototype.sources = function(_params, _callback) {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].uName);
   }

   _callback(null, sources);
};

CasaConsoleApi.prototype.services = function(_params, _callback) {
   var services = [];

   for (var service in this.myObj().services) {
      services.push(this.myObj().services[service].uName);
   }

   _callback(null, services);
};

CasaConsoleApi.prototype.createThing = function(_params, _callback) {
   this.checkParams(1, _params);

   if (!this.gang.findObject(_params[0])) {
      var thingObj = this.gang.createThing({uName: _params[0]});
      return _callback(null, true);
   }
   else {
      return _callback(null, false);
   }
};

CasaConsoleApi.prototype.restart = function(_params, _callback) {
   process.exit(3);
};

CasaConsoleApi.prototype.updateDb = function(_params, _callback) {
   this.checkParams(2, _params);

   var dbName = (_params.length > 2) ? _params[2] : this.gang.casa.uName;
   var localHash = this.dbService.getDbHash(dbName);

   this.dbService.getPeerDbHash(dbName, localHash, _params[0], _params[1], (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }
      else if (localHash.hash !== _result.hash) {
         this.dbService.getAndWritePeerDb(dbName, _params[0], _params[1], this.gang.configPath(), _callback);
      }
      else {
         _callback(null, true);
      }
   });
};

CasaConsoleApi.prototype.updateDbs = function(_params, _callback) {
   this.checkParams(2, _params);
   this.updateDb(_params, (_err, _result) => {

      if (_err)  {
         _callback(_err);
      }
      else {
         _params.push(this.gang.uName);
         this.updateDb(_params, _callback);
      }
   });
};

CasaConsoleApi.prototype.exportDb = function(_params, _callback) {
   this.gang.casa.getDb().readAll(_callback);
};

CasaConsoleApi.prototype.importDb = function(_params, _callback) {
   this.updateDb(_params, _callback);
};

module.exports = exports = CasaConsoleApi;
 
