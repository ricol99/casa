var ConsoleCmd = require('../consolecmd');
var util = require('util');

function GangConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(GangConsoleCmd, ConsoleCmd);

// Called when current state required
GangConsoleCmd.prototype.export = function(_exportObj) {
   ConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
GangConsoleCmd.prototype.import = function(_importObj) {
   ConsoleCmd.prototype.import.call(this, _importObj);
};

GangConsoleCmd.prototype.coldStart = function() {
   ConsoleCmd.prototype.coldStart.call(this);
};

GangConsoleCmd.prototype.hotStart = function() {
   ConsoleCmd.prototype.hotStart.call(this);
};

GangConsoleCmd.prototype.reboot = function(_arguments, _callback)  {

   if (_arguments && (_arguments.length > 0) && (_arguments === "--hard")) {
      this.executeParsedCommandOnAllCasas("reboot", [ true ], _callback);
   }
   else {
      this.executeParsedCommandOnAllCasas("reboot", _arguments, _callback);
   }
};

GangConsoleCmd.prototype.restart = function(_arguments, _callback)  {

   if (_arguments && (_arguments.length > 0) && (_arguments === "--hard")) {
      this.executeParsedCommandOnAllCasas("restart", [ true ], _callback);
   }
   else {
      this.executeParsedCommandOnAllCasas("restart", _arguments, _callback);
   }
};

GangConsoleCmd.prototype.pushDbs = function(_arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();
   this.executeParsedCommandOnAllCasas("updateDbs", [ myAddress, port ], _callback);
};

GangConsoleCmd.prototype.pushDb = function(_arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();
   this.executeParsedCommandOnAllCasas("updateDb", [ myAddress, port ], _callback);
};

GangConsoleCmd.prototype.pullDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   if (this.console.dbCompare() !== 0) {
      this.dbService.getAndWritePeerDb(this.gang.getDb().name, this.console.getCurrentCasa().getHost(), this.console.getCurrentCasa().getListeningPort(), this.gang.configPath(), _callback);
   }
   else {
      return _callback(null, true);
   }
};

GangConsoleCmd.prototype.exportDb = function(_arguments, _callback) {

   this.checkArguments(0, _arguments);

   this.pullDb([], (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      var db = this.gang.getDb();

      db.readAll( (_err, _result) => {

         if (_err) {
            return _callback(_err);
         }

         Db = require('../db');
         var output = Db.export(_result);
         var fileName = this.gang.configPath() + "/configs/" + this.gang.getDb().name + ".json";
         var fs = require('fs');
         var content = JSON.stringify(output, null, 3);

         fs.writeFile(fileName, content, (_err) => {
            return _callback(_err, true);
         });
      });
   });
};

GangConsoleCmd.prototype.importDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var cjson = require('cjson');
   var configFilename = this.gang.configPath() + "/configs/" + this.gang.getDb().name + ".json";
   var inputConfig = cjson.load(configFilename);

   if (inputConfig.gang.name !== this.gang.name) {
      return _callback("Config file corrupt.");
   }
      
   var Db = require('../db');
   var db = new Db(this.gang.name, undefined, true);
      

   db.on('connected', () => {
      var collections = {};
      collections.gang = { "name": "", "type": "", "displayName": "", "parentCasa": {} };

      for (var param in collections.gang) {

         if (inputConfig.gang.hasOwnProperty(param)) {
            collections.gang[param] = inputConfig.gang[param];
         }
      }

      collections.gangUsers = inputConfig.hasOwnProperty("gangUsers") ? inputConfig.gangUsers : inputConfig.gang.hasOwnProperty("users") ? inputConfig.gang.users : [];
      collections.gangScenes = inputConfig.hasOwnProperty("gangScenes") ? inputConfig.gangScenes : inputConfig.gang.hasOwnProperty("scenes") ? inputConfig.gang.scenes : [];
      collections.gangThings = inputConfig.hasOwnProperty("gangThings") ? inputConfig.gangThings : inputConfig.gang.hasOwnProperty("things") ? inputConfig.gang.things : [];

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

         this.executeParsedCommandOnAllCasas("updateDb", [ myAddress, port], _callback);
      });
   });

   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });

   db.connect();
};

module.exports = exports = GangConsoleCmd;
 
