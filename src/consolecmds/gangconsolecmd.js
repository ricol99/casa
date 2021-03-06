var ConsoleCmd = require('../consolecmd');
var util = require('util');

function GangConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(GangConsoleCmd, ConsoleCmd);

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

GangConsoleCmd.prototype.updateDbs = function(_arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();
   this.executeParsedCommandOnAllCasas("updateDbs", [ myAddress, port ], _callback);
};

GangConsoleCmd.prototype.updateDb = function(_arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();
   this.executeParsedCommandOnAllCasas("updateDb", [ myAddress, port ], _callback);
};

GangConsoleCmd.prototype.exportDb = function(_arguments, _callback) {

   this.executeParsedCommand("exportDb", null, (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      Db = require('../db');
      var output = Db.export(_result);
      var fileName = this.gang.configPath() + "/configs/" + this.gang.name + ".json";
      var fs = require('fs');
      var content = JSON.stringify(output, null, 3);

      fs.writeFile(fileName, content, (_err) => {
         _callback(_err, true);
      });
   });
};

GangConsoleCmd.prototype.importDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   
   var cjson = require('cjson');
   var configFilename = this.gang.configPath() + "/configs/" + this.gang.name + ".json";
   var inputConfig = cjson.load(configFilename); 
   
   if (inputConfig.gang.name !== this.gang.name) {
      return _callback("Config file corrupt.");
   }  
   
   var Db = require('../db');
   var db = new Db(this.gang.name, undefined, true);
   
   db.on('connected', () => {
      var configs = {};
      configs.gang = { "name": "", "type": "", "displayName": "", "parentCasa": {} };
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
      
      this.executeParsedCommandOnAllCasas("updateDb", [ myAddress, port], _callback);
   });
   
   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });
   
   db.connect();
}; 

module.exports = exports = GangConsoleCmd;
 
