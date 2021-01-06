var ConsoleApi = require('../consoleapi');
var util = require('util');

function GangConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.dbService =  this.gang.casa.findService("dbservice");
}

util.inherits(GangConsoleApi, ConsoleApi);

GangConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult, _perfectMatchRequired)  {
   var collection = {};
   ConsoleApi.prototype.filterScope.call(this, _scope, this.gang.allObjects, _prevResult, _perfectMatchRequired);
};

GangConsoleApi.prototype.cat = function(_session, _params, _callback) {
   _callback(null, {});
};

GangConsoleApi.prototype.createUser = function(_session, _params, _callback) {

   if (params.length < 1) {
       return _callback("Name not passed as a parameter");
   }

   if (!this.gang.findNamedObject(_params[0])) {
      var userObj = this.gang.createUser({name: _params[0], type: "user"});
      return _callback(null, true);
   }
   else {
      return _callback(null, false);
   }
};

GangConsoleApi.prototype.restart = function(_session, _params, _callback) {
   process.exit(3);
};

GangConsoleApi.prototype.updateDb = function(_session, _params, _callback) {
   this.checkParams(2, _params);

   var dbName = (_params.length > 2) ? _params[2] : this.gang.name;
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

GangConsoleApi.prototype.updateDbs = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   this.updateDb(_session, _params, (_err, _result) => {

      if (_err)  {
         _callback(_err);
      }
      else {
         _params.push(this.gang.casa.name);
         this.updateDb(_session, _params, _callback);
      }
   });
};

GangConsoleApi.prototype.exportDb = function(_session, _params, _callback) {
   this.gang.getDb().readAll(_callback);
};

GangConsoleApi.prototype.importDb = function(_session, _params, _callback) {
   this.updateDb(_session, _params, _callback);
};

module.exports = exports = GangConsoleApi;
 
