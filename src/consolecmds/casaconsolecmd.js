var ConsoleCmd = require('../consolecmd');
var util = require('util');

function CasaConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(CasaConsoleCmd, ConsoleCmd);

CasaConsoleCmd.prototype.restart = function(_arguments, _callback)  {
   this.executeParsedCommand("restart", _arguments, _callback);
};


CasaConsoleCmd.prototype.pushDbs = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   this.executeParsedCommand("pushDbs", [ myAddress, port], _callback);
};

CasaConsoleCmd.prototype.pushDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();

   this.executeParsedCommand("pushDb", [ myAddress, port], _callback);
};

CasaConsoleCmd.prototype.pullDb = function(_arguments, _callback) {
   /// TDB To be comnpleted!
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("pullDb", null, (_err, _result) => {

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

CasaConsoleCmd.prototype.exportDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   this.executeParsedCommand("exportDb", null, (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }
     
      Db = require('../db');
      var output = Db.export(_result);
      var fileName = this.gang.configPath() + "/configs/" + this.myObjName + ".json";
      var fs = require('fs');
      var content = JSON.stringify(output, null, 3);

      fs.writeFile(fileName, content, (_err) => {
         _callback(_err, true);
      });
   });
};

CasaConsoleCmd.prototype.importDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var cjson = require('cjson');
   var configFilename = this.gang.configPath() + "/configs/" + this.myObjName + ".json";
   var inputConfig = cjson.load(configFilename);

   if (inputConfig.casa.name !== this.myObjName) {
      return _callback("Config file corrupt.");
   }

   var Db = require('../db');
   var db = new Db(this.myObjName, undefined, true);
  
   db.on('connected', () => {
      var configs = {};
      configs.casa = { "name": "", "type": "", "displayName": "", "location": {}, "gang": "", "listeningPort": 0 };
      configs.users = [];
      configs.services = [];
      configs.scenes = [];
      configs.things = [];

      for (var section in configs) {

         if (configs.hasOwnProperty(section) && inputConfig.hasOwnProperty(section)) {

            if (configs[section] instanceof Array || (util.memberCount(configs[section]) === 0)) {

               if (inputConfig.hasOwnProperty(section)) {
                  configs[section] = inputConfig[section];
                  db.appendToCollection(section, configs[section]);
               }
            }
            else {
               for (var param in configs[section]) {

                  if (inputConfig.hasOwnProperty(section) && inputConfig[section].hasOwnProperty(param)) {
                     configs[section][param] = inputConfig[section][param];
                  }
               }
               db.appendToCollection(section, configs[section]);
            }
         }
      }

      db.close();
      var myAddress = util.getLocalIpAddress();
      var port = this.gang.mainListeningPort();

      this.executeParsedCommand("pushDb", [ myAddress, port], _callback);
   });

   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });

   db.connect();
};

module.exports = exports = CasaConsoleCmd;
