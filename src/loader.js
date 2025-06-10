var util = require('./util');
var AsyncEmitter = require('./asyncemitter');
var Db = require('./db');
var Gang = require('./gang');
const fs = require('fs');
  
var _mainInstance = null;
_loadTime = Date.now();

function Loader(_casaName, _connectToPeers, _secureMode, _certPath, _configPath, _version, _console, _logEvents, _testUncaughtException) {
   this.gang = null;
   this.casaName = _casaName;
   this.connectToPeers = _connectToPeers;
   this.secureMode = _secureMode;
   this.certPath = _certPath;
   this.configPath = _configPath;
   this.globalConsoleRequired = (_console) ? _console === "global" : false;
   this.localConsoleRequired = (_console) ? _console === "local" : false;
   this.logEvents = _logEvents;

   if (_testUncaughtException) {
      setTimeout( () => {
         crash; // Intentionally cause an exception as crash does not exist
      }, _testUncaughtException * 1000);
   }
};

Loader.prototype.load = function() {
   _mainInstance = this;

   if (this.globalConsoleRequired) {
      this.loadConsole();
   }
   else {
      if (fs.existsSync(this.configPath + "/hotstate-"+this.casaName+".json")) {
         var importObj = require(this.configPath + "/hotstate-"+this.casaName+".json");
         fs.unlinkSync(this.configPath + "/hotstate-"+this.casaName+".json");

         if (importObj && importObj.timestamp && ((Date.now() - importObj.timestamp) < 30000)) {
            console.log("*LOADER*: Valid suspension state found, attempting restoration");
            this.restoreNode(importObj.tree);
         }
         else {
            this.loadNode();
         }
      }
      else {
         this.loadNode();
      }
   }
};

/*process.on('uncaughtException', (_err) => {

   if ((Date.now() - _loadTime) < 30000) {
      process.stdout.write("*LOADER*: Unable to attempt suspension because the excpetion occurred too early in the start up sequence!\n");
      process.stderr.write("*LOADER*: There was an uncaught error "+util.inspect(_err)+"\n")
      process.exit(1);
   }
   else {
      _loadTime = Date.now();

      if (_mainInstance && !_mainInstance.globalConsoleRequired) {

         if (util.suspensionAvailable() && AsyncEmitter.suspensionAvailable() ) {
            console.log("*LOADER*: Attempting suspension");
            var exportObj = { timestamp: Date.now(), tree: {}};
            _mainInstance.gang.export(exportObj.tree);
            fs.writeFileSync(_mainInstance.configPath + "/hotstate-"+_mainInstance.gang.casa.name+".json", JSON.stringify(exportObj));
            console.log("*LOADER*: State persisted");
            process.exit(2);
         }
         else {
            process.stdout.write("*LOADER*: Unable to attempt suspension as uncaught exception was in casa code stack\n");
            process.stderr.write("*LOADER*: There was an uncaught error "+util.inspect(_err)+"\n")
            process.exit(1);
         }
      }
      else {
         process.stderr.write("*LOADER*: There was an uncaught error " + util.inspect( _err) + "\n")
         process.exit(1);
      }
   }
});*/

Loader.prototype.suspend = function() {
   _loadTime = Date.now();

   if (this.gang && !this.gang.globalConsoleRequired) {
      console.log(this.uName +": Attempting suspension");
      var exportObj = { timestamp: Date.now(), tree: {}};
      _mainInstance.gang.export(exportObj.tree);
      fs.writeFileSync(_mainInstance.configPath + "/hotstate-"+_mainInstance.gang.casa.name+".json", JSON.stringify(exportObj));
      console.log("*LOADER*: State persisted");
      process.exit(2);
   }
   else {
      console.log(this.uName +": Unable to suspend!");
      return false;
   }
};

Loader.prototype.loadNode = function() {
   this.casaDb = new Db(this.casaName+"-db", this.configPath, false, null);

   this.casaDb.on('connected', (_data) => {

      this.casaConfig = this.loadCasaConfig(this.casaDb, (_err, _res) => {

         if (_err) {
            console.error("Unable to load casa DB. Error=" + _err);
            process.exit(1);
         }

         this.casaConfig.connectToPeers = this.connectToPeers;
         this.casaConfig.secureMode = this.secureMode;
         this.casaConfig.certPath = this.certPath;
         this.casaConfig.configPath = this.configPath;
         this.casaConfig.logEvents = this.logEvents;

         this.gangDb = new Db(this.casaConfig.gang+"-db", this.configPath, false, null);

         this.gangDb.on('connected', (_data) => {

            this.loadGangConfig(this.gangDb, (_err, _config) => {

               if (_err) {
                  console.error("Unable to load gang DB. Exiting... Error=" + _err);
                  process.exit(2);
                  return;
               }

               this.mergeConfigs();
               this.gangConfig.casa = this.casaConfig;

               this.addSystemServices();

               this.gang = new Gang(this.gangConfig, this);
               this.casaDb.setOwner(this.gang);
               this.gang.casa.db = this.casaDb;
               this.gangDb.setOwner(this.gang);
               this.gang.gangDb = this.gangDb;

               this.gang.buildTree();
               this.gang.coldStart();

               if (this.localConsoleRequired) {
                  var LocalConsole = require('./localconsole');
                  this.localConsole = new LocalConsole(this.gang);
                  this.localConsole.coldStart();
               }
            });
         });

         this.gangDb.connect();
      });
   });

   this.casaDb.connect();
};

Loader.prototype.restoreNode = function(_importObj) {
   this.casaDb = new Db(_importObj.casa+"-db", this.configPath, false, null);

   this.casaDb.on('connected', (_data) => {
      this.gangDb = new Db(_importObj.name+"-db", this.configPath, false, null);

      this.gangDb.on('connected', (_data) => {

         this.gang = new Gang(_importObj.config, this);

         this.casaDb.setOwner(this.gang);
         this.gang.casa.db = this.casaDb;
         this.gangDb.setOwner(this.gang);
         this.gang.gangDb = this.gangDb;

         this.gang.buildTree();
         this.gang.import(_importObj);
         this.gang.hotStart();

         if (this.localConsoleRequired) {
            var LocalConsole = require('./localconsole');
            this.localConsole = new LocalConsole(this.gang);
            this.localConsole.coldStart();
         }
      });

      this.gangDb.connect();
   });

   this.casaDb.connect();
};

Loader.prototype.loadConsole = function() {
   this.gangName = this.casaName;
   this.casaName = "casa-console";

   this.casaConfig = { name: this.casaName, type: "casa", secureMode: this.secureMode, connectToPeers: false, certPath: this.certPath, configPath: this.configPath, listeningPort: 8999 };
   this.gangConfig = { name: this.gangName, type: "gang", casa: this.casaConfig };
   this.gangConfig.casa = this.casaConfig;


   this.gang = new Gang(this.gangConfig, this);
   this.gangDb = new Db(this.gangName+"-db", this.configPath, false, null);
   this.gangDb.setOwner(this.gang);
   this.gang.gangDb = this.gangDb;

   this.gangDb.on('connected', (_data) => {

      this.gangDb.readCollection("gangServices", (_err, _services) => {
         
         if (!_err) {
            this.gangConfig.services = _services;
            this.addSystemServices();

            this.gang.buildTree();
            this.gang.coldStart();

            var Console = require('./console');
            this.console = new Console({ gangName: this.gangName, casaName: null, secureMode: this.secureMode, certPath: this.certPath }, this.gang);
            this.console.coldStart();
         }
      });
   });

   this.gangDb.on('connect-error', (_data) => {
      gangDb = new Db(this.gangName+"-db", this.configPath, true, null);

      this.gangDb.on('connected', (_data) => {
         this.gangDb.appendToCollection("gang", { name: this.gangName, type: "gang", secureMode: this.secureMode, certPath: this.certPath, configPath: this.configPath, listeningPort: 8999 });

         this.gang.buildTree();
         this.gang.coldStart();
         var Console = require('./console');
         this.console = new Console({ gangName: this.gangName, casaName: null, secureMode: this.secureMode, certPath: this.certPath });
         this.console.coldStart();
      });

      this.gangDb.on('connect-error', (_data) => {
         process.stderr.write("Unable to create gang database\n");
         process.exit(1);
      });

      this.gangDb.connect();
   });

   this.gangDb.connect();
};

Loader.prototype.markObjects = function(_objects, _markId, _markValue) {

   if (_objects) {

      for (var i = 0; i < _objects.length; ++i) {
         _objects[i][_markId] = _markValue;
      }
   }
};

Loader.prototype.loadCasaConfig = function(_db, _callback) {

   _db.readCollection("casa", (_err, _mainConfig) => {

      if (_err || (_mainConfig.length == 0)) {
         return _callback("No main config found!");
      }

      this.casaConfig = _mainConfig[0];

      _db.readCollection("casaUsers", (_err, _users) => {

         if (!_err) {
            this.casaConfig.users = _users;
            this.markObjects(this.casaConfig.users, "_db", this.casaConfig.name);
         }
         _db.readCollection("casaServices", (_err, _services) => {

            if (!_err) {
               this.casaConfig.services = _services;
               this.markObjects(this.casaConfig.sevices, "_db", this.casaConfig.name);
            }

            _db.readCollection("casaScenes", (_err, _scenes) => {

               if (!_err) {
                  this.casaConfig.scenes = _scenes;
                  this.markObjects(this.casaConfig.scenes, "_db", this.casaConfig.name);
               }

               _db.readCollection("casaThings", (_err, _casaThings) => {

                  if (!_err) {
                     this.casaConfig.things = _casaThings;
                     this.markObjects(this.casaConfig.things, "_db", this.casaConfig.name);
                  }

                  _db.readCollection("gangThings", (_err, _gangThings) => {

                     if (!_err) {
                        this.casaConfig.gangThings = _gangThings;
                        this.markObjects(this.casaConfig.gangThings, "_db", this.casaConfig.name);
                     }

                     _db.readCollection("gangServices", (_err, _gangServices) => {

                        if (!_err) {
                           this.casaConfig.gangServices = _gangServices;
                           this.markObjects(this.casaConfig.gangServices, "_db", this.casaConfig.name);
                        }

                        _db.readCollection("gangScenes", (_err, _gangScenes) => {

                           if (!_err) {
                              this.casaConfig.gangScenes = _gangScenes;
                              this.markObjects(this.casaConfig.gangScenes, "_db", this.casaConfig.name);
                           }

                           _callback(null, true);
                        });
                     });
                  });
               });
            });
         });
      });
   });
};

Loader.prototype.loadGangConfig = function(_db, _callback) {

   _db.readCollection("gang", (_err, _mainConfig) => {

      if (_err || (_mainConfig.length == 0)) {
         return _callback("No main config found!");
      }

      this.gangConfig = _mainConfig[0];

      _db.readCollection("gangUsers", (_err, _users) => {

         if (!_err) {
            this.gangConfig.users = _users;
            this.markObjects(this.gangConfig.users, "_db", this.gangConfig.name);
         }

         _db.readCollection("gangServices", (_err, _services) => {

            if (!_err) {
               this.gangConfig.services = _services;
               this.markObjects(this.gangConfig.services, "_db", this.gangConfig.name);
            }

            _db.readCollection("gangScenes", (_err, _scenes) => {

               if (!_err) {
                  this.gangConfig.scenes = _scenes;
                  this.markObjects(this.gangConfig.scenes, "_db", this.gangConfig.name);
               }

               _db.readCollection("gangThings", (_err, _things) => {

                  if (!_err) {
                     this.gangConfig.things = _things;
                     this.markObjects(_things, "_db", this.gangConfig.name);
                  }
                  _callback(null, true);
               });
            });
         });
      });
   });
};

Loader.prototype.addSystemServices = function() {

   if (!this.gangConfig.casa.services) {
      this.gangConfig.casa.services = [];
   }

   var serviceExists = {};

   for (var i = 0; i < this.gangConfig.casa.services.length; ++i) {
      serviceExists[this.gangConfig.casa.services[i].name] = true;
   }

   if (this.gangConfig.services) {

      for (var l = 0; l < this.gangConfig.services.length; ++l) {

         if (!serviceExists[this.gangConfig.services[l].name]) {
            this.gangConfig.casa.services.push(this.gangConfig.services[l]);
         }
      }
   }

   var systemServiceConfigs = { "io-message-socket-service": { name: "io-message-socket-service", type: "iomessagesocketservice" },
                                "casa-discovery-service": { name: "casa-discovery-service", type: "casadiscoveryservice" },
                                "console-api-service": { name: "console-api-service", type: "consoleapiservice" },
                                "db-service": { name: "db-service", type: "dbservice" },
                                "ramp-service": { name: "ramp-service", type: "rampservice" },
                                "schedule-service": { name: "schedule-service", type: "scheduleservice", latitude:  51.5, longitude: -0.1, forecastKey: "5d3be692ae5ea4f3b785973e1f9ea520" },
                                "event-logging-service": { name: "event-logging-service", type: "eventloggingservice" }};

   for (var serviceName in systemServiceConfigs) {

      if (systemServiceConfigs.hasOwnProperty(serviceName) && !serviceExists.hasOwnProperty(serviceName)) {
         this.gangConfig.casa.services.unshift(systemServiceConfigs[serviceName]);
      }
   }

};

Loader.prototype.mergeThing = function(_sourceThing, _destThing, _override) {

   if (!_sourceThing.hasOwnProperty("properties")) {
      return;
   }

   if (!_destThing.hasOwnProperty("properties")) {
      _destThing.properties = _sourceThing.properties;
      return;
   }

   var tempAssoc = {};

   for (var j = 0; j < _destThing.properties.length; ++j) {
      tempAssoc[_destThing.properties[j].name] = j;
   }

   for (var i = 0; i < _sourceThing.properties.length; ++i) {

      if (tempAssoc.hasOwnProperty(_sourceThing.properties[i].name)) {

         if (_override) {
            _destThing.properties[tempAssoc[_sourceThing.properties[i].name]] = _sourceThing.properties[i];
         }
      }
      else {
         _destThing.properties.push(_sourceThing.properties[i]);
      }
   }

};

Loader.prototype.mergeThings = function(_sourceThings, _destThings, _override) {
   var tempAssoc = {};

   for (var j = 0; j < _destThings.length; ++j) {
      tempAssoc[_destThings[j].name] = j;
   }

   for (var i = 0; i < _sourceThings.length; ++i) {

      if (tempAssoc.hasOwnProperty(_sourceThings[i].name)) {
         this.mergeThing(_sourceThings[i], _destThings[tempAssoc[_sourceThings[i].name]]);
      }
      else {
         _destThings.push(_sourceThings[i]);
      }
   }
};

Loader.prototype.mergeConfigs = function() {

   if (this.gangConfig.hasOwnProperty("things")) {

      if (this.casaConfig.hasOwnProperty("things")) {
         this.mergeThings(this.casaConfig.gangThings, this.gangConfig.things, false);
      }
      else {
         this.gangConfig.things = this.casaConfig.gangThings;
      }
   }

   if (this.gangConfig.hasOwnProperty("services")) {

      if (this.casaConfig.hasOwnProperty("services")) {
         this.mergeThings(this.casaConfig.gangServices, this.gangConfig.services, false);
      }
      else {
         this.gangConfig.services = this.casaConfig.gangServices;
      }
   }
};

module.exports = exports = Loader;
