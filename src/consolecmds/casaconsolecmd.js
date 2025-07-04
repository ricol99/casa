var ConsoleCmd = require('../consolecmd');
var util = require('util');

function CasaConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(CasaConsoleCmd, ConsoleCmd);

// Called when current state required
CasaConsoleCmd.prototype.export = function(_exportObj) {
   ConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
CasaConsoleCmd.prototype.import = function(_importObj) {
   ConsoleCmd.prototype.import.call(this, _importObj);
};

CasaConsoleCmd.prototype.coldStart = function() {
   ConsoleCmd.prototype.coldStart.call(this);
};

CasaConsoleCmd.prototype.hotStart = function() {
   ConsoleCmd.prototype.hotStart.call(this);
};

CasaConsoleCmd.prototype.reboot = function(_arguments, _callback)  {

   if (_arguments && (_arguments.length > 0) && (_arguments === "--hard")) {
      this.executeParsedCommand("reboot", [ true ], _callback);
   }
   else {
      this.executeParsedCommand("reboot", _arguments, _callback);
   }
};

CasaConsoleCmd.prototype.restart = function(_arguments, _callback)  {
 
   if (_arguments && (_arguments.length > 0) && (_arguments === "--hard")) {
      this.executeParsedCommand("restart", [ true ], _callback);
   }
   else {
      this.executeParsedCommand("restart", _arguments, _callback);
   }
};

CasaConsoleCmd.prototype.exportData = function(_arguments, _callback)  {
   this.executeParsedCommand("exportData", _arguments, _callback);
};


CasaConsoleCmd.prototype.pushDbs = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   this.executeParsedCommand("updateDbs", [ myAddress, port], _callback);
};

CasaConsoleCmd.prototype.pushDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   this.executeParsedCommand("updateDb", [ myAddress, port], _callback);
};

CasaConsoleCmd.prototype.pullDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   if (this.casa.dbCompare() !== 0) {
      this.dbService.getAndWritePeerDb(this.casa.getDbName(), this.casa.getHost(), this.casa.getListeningPort(), this.gang.configPath(), _callback);
   }
   else {
      return _callback(null, true);
   }
};

CasaConsoleCmd.prototype.exportDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   this.pullDb([], (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      this.gang.getDb(this.casa.getDbName(), undefined, (_err, _db) => {

         if (_err) {
            return _callback(_err);
         }

         _db.readAll( (_err, _result) => {

            if (_err) {
               return _callback(_err);
            }

            Db = require('../db');
            var output = Db.export(_result);
            var fileName = this.gang.configPath() + "/configs/" + this.casa.getDbName() + ".json";
            var fs = require('fs');
            var content = JSON.stringify(output, null, 3);

            fs.writeFile(fileName, content, (_err) => {
               return _callback(_err, true);
            });
         });
      });
   });
};

CasaConsoleCmd.prototype.importDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var cjson = require('cjson');
   var configFilename = this.gang.configPath() + "/configs/" + this.casa.getDbName() + ".json";
   var inputConfig = cjson.load(configFilename);

   if (inputConfig.casa.name !== this.name) {
      return _callback("Config file corrupt.");
   }

   var Db = require('../db');
   var db = new Db(this.casa.getDbName(), undefined, true);

   db.on('connected', () => {
      var collections = {};
      var writeAdditionalGangDb = false;

      collections.casa = { "name": "", "type": "", "displayName": "", "location": {}, "listeningPort": 0 };

      for (var param in collections.casa) {

         if (inputConfig.casa.hasOwnProperty(param)) {
            collections.casa[param] = inputConfig.casa[param];
         }
      }

      collections.casaServices = inputConfig.hasOwnProperty("casaServices") ? inputConfig.casaServices : inputConfig.casa.hasOwnProperty("services") ? inputConfig.casa.services : [];
      collections.casaScenes = inputConfig.hasOwnProperty("casaScenes") ? inputConfig.casaScenes : inputConfig.casa.hasOwnProperty("scenes") ? inputConfig.casa.scenes : [];
      collections.casaThings = inputConfig.hasOwnProperty("casaThings") ? inputConfig.casaThings : inputConfig.casa.hasOwnProperty("things") ? inputConfig.casa.things : [];
      collections.casaUsers = inputConfig.hasOwnProperty("casaUsers") ? inputConfig.casaUsers : inputConfig.casa.hasOwnProperty("users") ? inputConfig.casa.users : [];

      if (inputConfig.hasOwnProperty("gang")) {
         collections.casa.gang = inputConfig.gang.name;
         collections.gangThings = inputConfig.hasOwnProperty("gangThings") ? inputConfig.gangThings : inputConfig.gang.hasOwnProperty("things") ? inputConfig.gang.things : [];
         collections.gangScenes = inputConfig.hasOwnProperty("gangScenes") ? inputConfig.gangScenes : inputConfig.gang.hasOwnProperty("scenes") ? inputConfig.gang.scenes : [];
         collections.gangServices = inputConfig.hasOwnProperty("gangServices") ? inputConfig.gangServices : inputConfig.gang.hasOwnProperty("services") ? inputConfig.gang.services : [];
      }
      else if (inputConfig.casa.hasOwnProperty("gang")) {
         collections.casa.gang = inputConfig.casa.gang;
         collections.gangThings = inputConfig.hasOwnProperty("gangThings") ? inputConfig.gangThings : [];
         collections.gangServices = inputConfig.hasOwnProperty("gangServices") ? inputConfig.gangServices : [];
         collections.gangScenes = inputConfig.hasOwnProperty("gangScenes") ? inputConfig.gangScenes : [];
      }
      else {
         collections.casa.gang = collections.casa.name + "-gang";
         collections.gangThings = [];
         collections.gangServices = [];
         collections.gangScenes = [];
         writeAdditionalGangDb = true;
      }

      for (var collection in collections) {

         if (collections.hasOwnProperty(collection)) {
            db.appendToCollection(collection, collections[collection]);
         }
      }

      db.readCollection("gangThings", (_err, _res) => {
         db.close();

         if (_err) {
            return _callback("Failed to create DB. Error="+_err);
         }

         var myAddress = util.getLocalIpAddress();
         var port = this.gang.mainListeningPort();

         this.executeParsedCommand("updateDb", [ myAddress, port], (_err, _res) => {
            return _callback(_err, true);
            // TBD
            if (writeAdditionalGangDb) {
               var gangConfig = { gang: { "name": collections.casa.name + "-gang", "type": "gang", "displayName": "Gang for " + collections.casa.name, "parentCasa": {} }};
               //populateDbFromConfig(gangConfig, false); // TBD - call the gang importDB
            }
         }); 

      });
   });

   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });

   db.connect();
};

module.exports = exports = CasaConsoleCmd;
