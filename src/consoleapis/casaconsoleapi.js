var util = require('util');
var ConsoleApi = require('../consoleapi');

function CasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.dbService =  this.gang.casa.findService("dbservice");
}

util.inherits(CasaConsoleApi, ConsoleApi);

// Called when current state required
CasaConsoleApi.prototype.export = function(_exportObj) {
   ConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
CasaConsoleApi.prototype.import = function(_importObj) {
   ConsoleApi.prototype.import.call(this, _importObj);
};

CasaConsoleApi.prototype.coldStart = function() {
   ConsoleApi.prototype.coldStart.call(this);
};

CasaConsoleApi.prototype.hotStart = function() {
   ConsoleApi.prototype.hotStart.call(this);
};

CasaConsoleApi.prototype.exportData = function(_session, _params, _callback) {
   var exportData = {};

   if (this.myObj().export(exportData)) {
      console.info("AAAAAA export=", exportData);
      _callback(null, exportData);
   }
   else {
      _callback("No objects to export!");
   }
};

CasaConsoleApi.prototype.exportDb = function(_session, _params, _callback) {
   var exportData = {};

   if (this.gang.exportDb(exportData)) {
      _callback(null, exportData);
   }
   else {
      _callback("No objects to export!");
   }
};

CasaConsoleApi.prototype.cat = function(_session, _params, _callback) {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].name);
      }
   }

   _callback(null, output);
};

CasaConsoleApi.prototype.sources = function(_session, _params, _callback) {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].name);
   }

   _callback(null, sources);
};

CasaConsoleApi.prototype.services = function(_session, _params, _callback) {
   var services = [];

   for (var service in this.myObj().services) {
      services.push(this.myObj().services[service].name);
   }

   _callback(null, services);
};

CasaConsoleApi.prototype.createService = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var newServiceConfig = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (this.gang.findService(newServiceConfig.name)) {
      return _callback("Service already exists!");
   }

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(newServiceConfig.name, (_err, _result) => {

         if (_err || (_result === null)) {
            var serviceObj = this.gang.createService(util.copy(newServiceConfig, true));

            this.db.appendToCollection("services", newServiceConfig, (_err2, _result2) => {

               if (_err2) {
                  return _callback("Not able to perist the change");
               }

               this.gang.casa.refreshSourceListeners();
               serviceObj.coldStart();
               return _callback(null, true);
            });
         }
         else {
            return _callback("Service already exists!");
         }
      });
   }
   else {
      var serviceObj = this.gang.createService(newServiceConfig);
      this.gang.casa.refreshSourceListeners();
      serviceObj.coldStart();
      _callback(null, true);
   }
};

CasaConsoleApi.prototype.createThing = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var newThingConfig = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (this.gang.findNamedObject("::"+newThingConfig.name)) {
      return _callback("Thing already exists!");
   }

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(newThingConfig.name, (_err, _result) => {

         if (_err || (_result === null)) {
            var thingObj = this.gang.createThing(util.copy(newThingConfig, true));

            this.db.appendToCollection("things", newThingConfig, (_err2, _result2) => {

               if (_err2) {
                  return _callback("Not able to perist the change");
               }

               this.gang.casa.refreshSourceListeners();
               thingObj.coldStart();
               return _callback(null, true);
            });
         }
         else {
            return _callback("Thing already exists!");
         }
      });
   }
   else {
      var thingObj = this.gang.createThing(newThingConfig);
      this.gang.casa.refreshSourceListeners();
      thingObj.coldStart();
      _callback(null, true);
   }
};

CasaConsoleApi.prototype.reboot = function(_session, _params, _callback) {

   if ((_params && (_params.length > 0) && _params[0]) || (!this.gang.ignoreRestart)) {
      require('reboot').reboot();
      return _callback("Unable to reboot - insufficient permissions!");
   }
   else {
      return _callback(this.gang.casa.uName + ": Ignoring reboot!");
   }
};

CasaConsoleApi.prototype.restart = function(_session, _params, _callback) {

   if ((_params && (_params.length > 0) && _params[0]) || (!this.gang.ignoreRestart)) {
      process.exit(3);
   }
   else {
      return _callback(this.gang.casa.uName + ": Ignoring restart!");
   }
};

CasaConsoleApi.prototype.updateDb = function(_session, _params, _callback) {
   this.checkParams(2, _params);

   var dbName = (_params.length > 2) ? _params[2] : this.gang.casa.name;
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

CasaConsoleApi.prototype.updateDbs = function(_session, _params, _callback) {
   this.checkParams(2, _params);

   this.updateDb(_params, (_err, _result) => {

      if (_err)  {
         _callback(_err);
      }
      else {
         _params.push(this.gang.name);
         this.updateDb(_params, _callback);
      }
   });
};

CasaConsoleApi.prototype.exportDb = function(_session, _params, _callback) {
   this.gang.casa.getDb().readAll(_callback);
};

module.exports = exports = CasaConsoleApi;
 
