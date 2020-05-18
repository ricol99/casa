var ConsoleCmd = require('../consolecmd');
var util = require('util');

function OfflineCasaConsoleCmd(_config, _console) {
   ConsoleCmd.call(this, _config, _console);
}

util.inherits(OfflineCasaConsoleCmd, ConsoleCmd);

OfflineCasaConsoleCmd.prototype.exportDb = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   var name = (_arguments && _arguments.length > 0) ? _arguments[0] : this.gang.name;

   this.gang.getDb(name, null, (_err, _db) =>  {

      if (_err) {
         return _callback(_err);
      }

      _db.readAll((_err2, _result) => {

         if (_err2) {
            return _callback(_err2);
         }

         Db = require('../db');
         var output = Db.export(_result);
         var fileName = this.gang.configPath() + "/configs/" + name + ".json";
         var fs = require('fs');
         var content = JSON.stringify(output, null, 3);

         fs.writeFile(fileName, content, (_err) => {
            _callback(_err, true);
         });
      });
   });
};

OfflineCasaConsoleCmd.prototype.importDb = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   var name = (_arguments && _arguments.length > 0) ? _arguments[0] : this.gang.name;

   var cjson = require('cjson');
   var configFilename = this.gang.configPath() + "/configs/" + name + ".json";
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
      _callback(null, true);
   });
   
   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });
   
   db.connect();
}; 

module.exports = exports = OfflineCasaConsoleCmd;
 
