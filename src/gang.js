var util = require('./util');
var S = require('string');
var Db = require('./db');
var NamedObject = require('./namedobject');

var _mainInstance = null;

function Gang(_casaName, _connectToPeers, _secureMode, _certPath, _configPath, _version, _console) {
   this.casaName = _casaName;
   this.version = _version;
   this._id = true;	// TDB!!!

   this.users = [];
   this.scenes = {};
   this.things = {};
   this.topLevelThings = [];
   this.casa = null;
   this.peerCasas = [];
   this.services = {};
   this.systemServices = {};
   this.constructors = {};

   this.dbs = {};
   this.dbCallbacks = {};

   _mainInstance = this;
 
   var globalConsole = (_console) ? _console === "global" : false;
   var localConsole = (_console) ? _console === "local" : false;

   if (!globalConsole) {
      this.casaDb = new Db(this.casaName, _configPath, false, null);
      this.dbs[this.casaName] = this.casaDb;

      this.casaDb.on('connected', (_data) => {
         this.dbs[_data.name] = _data.db;

         this.loadConfig(this.casaDb, "casa", (_err, _res) => {

            if (_err) {
               console.error("Unable to load casa DB. Error=" + _err);
               process.exit(1);
            }

            this.config.connectToPeers = _connectToPeers;
            this.config.secureMode = _secureMode;
            this.config.certPath = _certPath;
            this.config.configPath = _configPath;
            this.name = this.config.gang;
            NamedObject.call(this, { name: this.name, type: "gang" });
            this.casaDb.setOwner(this);

            this.loadSystemServices();

            this.gangDb = new Db(this.name, _configPath, false, this);
            this.dbs[this.name] = this.gangDb;

            this.gangDb.on('connected', (_data) => {
               this.dbs[_data.name] = _data.db;

               this.loadConfig(this.gangDb, "gang", (_err, _config) => {

                  if (_err) {

                     this.attemptToFetchGangDbFromPeer( (_err, _res) => {

                        if (_err) {
                           console.error("Unable to fetch gang DB from peer. Exiting... Error=" + _err);
                           process.exit(2);
                        }
                        else {

                           this.loadConfig(this.gangDb, "gang", (_err, _config) => {

                              if (_err) {
                                 console.error("Unable to load casa DB. Error=" + _err);
                                 process.exit(1);
                              }
                              else {
                                 this.init(localConsole);
                              }
                           });
                        }
                     });
                  }
                  else {
                     this.init(_console);
                  }
               });
            });

            this.gangDb.connect();
         });
      });

      this.casaDb.connect();
   }
   else {
      this.name = _casaName;
      NamedObject.call(this, { name: this.name, type: "gang" });
      this.casaName = "casa-console";

      this.config = { name: this.casaName, type: "casa", secureMode: _secureMode, certPath: _certPath, configPath: _configPath, listeningPort: 8999 };
      this.extractCasa();
      var casaShortName = this.casaName.split(":")[1];
      this.extractServices([ { name: "schedule-service", type: "scheduleservice",  latitude:  51.5, longitude: -0.1, forecastKey: "5d3be692ae5ea4f3b785973e1f9ea520" },
                             { name: "ramp-service", type: "rampservice"}, { name: "db-service", type: "dbservice"} ], false, this.systemServices);

      this.gangDb = new Db(this.name, _configPath, false, this);

      this.gangDb.on('connected', (_data) => {
         this.dbs[_data.name] = _data.db;
         var Console = require('./console');
         this.console = new Console({ gangName: this.name, casaName: null, secureMode: _secureMode, certPath: _certPath }, this);
         this.console.coldStart();
      });

      this.gangDb.on('connect-error', (_data) => {
         this.gangDb = new Db(this.name, _configPath, true, this);

         this.gangDb.on('connected', (_data) => {
            this.dbs[_data.name] = _data.db;
            this.gangDb.appendToCollection("gang", { name: this.name, type: "gang", secureMode: _secureMode, certPath: _certPath, configPath: _configPath, listeningPort: 8999 });
            var Console = require('./console');
            this.console = new Console({ gangName: this.name, casaName: null, secureMode: _secureMode, certPath: _certPath });
            this.console.coldStart();
         });

         this.gangDb.on('connect-error', (_data) => {
            process.stderr.write("Unable to create gang database\n");
            process.exit(1);
         });

         this.gangDb.connect();
      });

      this.gangDb.connect();
   }
};

util.inherits(Gang, NamedObject);

Gang.prototype.markObjects = function(_objects, _markId, _markValue) {

   if (_objects) {

      for (var i = 0; i < _objects.length; ++i) {
         _objects[i][_markId] = _markValue;
      }
   }
};

Gang.prototype.loadConfig = function(_db, _collection, _callback) {

   _db.readCollection(_collection, (_err, _mainConfig) => {

      if (_err || (_mainConfig.length == 0)) {
         return _callback("No main config found!");
      }

      var config;

      if (_collection === "gang") {
         this.gangConfig = _mainConfig[0];

         _db.readCollection("gangUsers", (_err, _users) => {

            if (!_err) {
               this.gangConfig.users = _users;
               this.markObjects(this.gangConfig.users, "_db", this.gangConfig.name); 
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
      }
      else {
         this.config = _mainConfig[0];

         _db.readCollection("casaUsers", (_err, _users) => {

            if (!_err) {
               this.config.users = _users;
               this.markObjects(this.config.users, "_db", this.config.name); 
            }
            _db.readCollection("casaServices", (_err, _services) => {

               if (!_err) {
                  this.config.services = _services;
                  this.markObjects(this.config.sevices, "_db", this.config.name); 
               }

               _db.readCollection("casaScenes", (_err, _scenes) => {

                  if (!_err) {
                     this.config.scenes = _scenes;
                     this.markObjects(this.config.scenes, "_db", this.config.name); 
                  }

                  _db.readCollection("casaThings", (_err, _casaThings) => {

                     if (!_err) {
                        this.config.things = _casaThings;
                        this.markObjects(this.config.things, "_db", this.config.name); 
                     }

                     _db.readCollection("gangThings", (_err, _gangThings) => {

                        if (!_err) {
                           this.config.gangThings = _gangThings;
                           this.markObjects(this.config.gangThings, "_db", this.config.name); 
                        }

                        _callback(null, true);
                     });
                  });
               });
            });
         });
      }
   });
};

Gang.prototype.attemptToFetchGangDbFromPeer = function(_callback) {

   var deathTimeout = setTimeout( () => {
      this.peerCasaService.setDbCallback(null);
      return _callback("No peer found to fetch DB from!");
   }, 20000);

   this.connectToPeers( (_err, _res) => {
      clearTimeout(deathTimeout);
      _callback(_err, _res);
   });

};

Gang.prototype.init = function(_console) {
   
   // Merge Configs
   this.mergeConfigs();

   // Extract Casa
   this.extractCasa();

   // Extract Services
   this.extractServices(this.config.services);

   this.addSystemServicesToCasa();

   if (_console) {
      var LocalConsole = require('./localconsole');
      this.localConsole = new LocalConsole(this);
      this.localConsole.coldStart();
   }

   // Extract Gang Users
   this.extractUsers(this.gangConfig.users, this);

   // Extract Casa Users
   this.extractUsers(this.config.users, this.casa);

   // Extract Scenes
   this.extractScenes(this.config.scenes);

   // Extract Gang Things
   this.extractThings(this.gangConfig.things, this);

   // Extract Casa Things
   this.extractThings(this.config.things, this.casa);

   // Make sure all listeners are refreshed now that all sources are available
   this.casa.refreshSourceListeners();

   // Cold start all defined things now that everything has been created
   this.coldStartThings();

   // Start connecting to Peers
   this.connectToPeers();
}

Gang.prototype.loadSystemServices = function(_dbCallback) {
   var casaShortName = this.casaName.split(":")[1];
   this.extractServices([ { name: "schedule-service", type: "scheduleservice",  latitude:  51.5, longitude: -0.1, forecastKey: "5d3be692ae5ea4f3b785973e1f9ea520" },
                          { name: "ramp-service", type: "rampservice" }, { name: "db-service", type: "dbservice" }, { name: "console-api-service", type: "consoleapiservice" } ], true, this.systemServices);
};

Gang.prototype.addSystemServicesToCasa = function() {

   for (service in this.systemServices) {

      if (this.systemServices.hasOwnProperty(service)) {
         this.casa.addService(this.systemServices[service]);
         this.systemServices[service].setOwner(this.casa);
      }
   }
};

Gang.prototype.connectToPeers = function(_dbCallback) {

   if (this.config.connectToPeers) {

      if (this.peerCasaService) {
         this.peerCasaService.exitFetchDbMode();
      }
      else {
         var PeerCasaService = require('./peercasaservice');
         this.peerCasaService = new PeerCasaService({ gang: this.config.gang, fetchDbMode: (_dbCallback != undefined) });

         if (_dbCallback) {
            this.peerCasaService.setDbCallback(_dbCallback);
         }
      }
   }
};

Gang.prototype.cleverRequire = function(_type, _path) {
   var path = '';

   if (_path && (_path !== _type+'s')) {
      path = _path + '/';
   }

   if (!this.constructors[_type]) {
      console.log('loading more code: ./' + _type);

      try {
         this.constructors[_type] = require('./' + path + _type);
      }
      catch (_err) {
         process.stderr.write(util.inspect(_err));
         return null;
      }
   }
   return this.constructors[_type];
}

// Extract Users
Gang.prototype.createUser = function(_user, _owner) {
   var User = this.cleverRequire(_user.type);
   var userObj = new User(_user, _owner);
   this.users[userObj.name] = userObj;
   console.log('New user: ' + userObj.name);
};

Gang.prototype.extractUsers = function(_config, _owner) {

   if (_config) {

      for (var i = 0; i < _config.length; ++i) { 
         this.createUser(_config[i], _owner);
      };
   }
};

// Extract Services
Gang.prototype.createService = function(_config, _serviceOwner) {
   console.log('Loading service '+ _config.name);
   var Service = this.cleverRequire(_config.type, 'services');

   if (!Service) {
      return null;
   }

   var serviceObj = new Service(_config, this.casa);
   this.services[serviceObj.type] = serviceObj;
   console.log('New service: ' + _config.name);

   if (_serviceOwner) {
      _serviceOwner[serviceObj.type] = serviceObj;
   }
   else {
      this.casa.addService(serviceObj);
   }

   return serviceObj;
};

Gang.prototype.extractServices = function(_config, _noColdStart, _serviceOwner) {

   if (_config) {
      console.log('Extracting services...');

      for (var index = 0; index < _config.length; ++index) {
         this.createService(_config[index], _serviceOwner);
      }

      if (!_noColdStart) {
         this.coldStartServices();
      }
   }
};

Gang.prototype.coldStartServices = function() {
   console.log('Cold starting services...');

   for (var serviceName in this.services) {

      if (this.services.hasOwnProperty(serviceName)) {
         console.log('Cold starting service '+ this.services[serviceName].name);
         this.services[serviceName].coldStart();
      }
   }
};

// Extract Scenes
Gang.prototype.createScene = function(_config, _parent) {
};

Gang.prototype.extractScenes = function(_config, _parent) {

   if (_config) {

      for (var index = 0; index < _config.length; ++index) {
         var Scene = this.cleverRequire(_config[index].type, 'scenes');
         var sceneObj = new Scene(_config[index], this);
         this.scenes[sceneObj.name] = sceneObj;
         console.log('New scene: ' + _config[index].name);
      }
   }
}

// Extract Things
Gang.prototype.createThing = function(_config, _owner) {
   var Thing = this.cleverRequire(_config.hasOwnProperty("type") ? _config.type : "thing", "things");

   if (!Thing) {
      console.error(this.uName + ": Thing "+_config.name+" does not exist");
      return null;
   }

   var thingObj = new Thing(_config, _owner);
   this.things[thingObj.uName] = thingObj;
   console.log('New thing: ' + thingObj.uName);
   return thingObj;
};

Gang.prototype.removeThing = function(_thing) {
   delete this.things[_thing.uName];
   this.removeNamedObject(_thing);
};

Gang.prototype.extractThings = function(_config, _owner) {
   var owner = _owner ? _owner : this;

   if (_config) {

      for (var index = 0; index < _config.length; ++index) {
         var thingObj = this.createThing(_config[index], owner);

         if (_config[index].things) {
            this.extractThings(_config[index].things, thingObj);

            if (thingObj.isTopLevelThing()) {
               thingObj.inheritChildProps();
            }
         }
      }
   }
};

Gang.prototype.mergeThing = function(_sourceThing, _destThing, _override) {

   if (!_sourceThing.hasOwnProperty("props")) {
      return;
   }

   if (!_destThing.hasOwnProperty("props")) {
      _destThing.props = _sourceThing.props;
      return;
   }

   var tempAssoc = {};

   for (var j = 0; j < _destThing.props.length; ++j) {
      tempAssoc[_destThing.props[j].name] = j;
   }

   for (var i = 0; i < _sourceThing.props.length; ++i) {

      if (tempAssoc.hasOwnProperty(_sourceThing.props[i].name)) {

         if (_override) {
            _destThing.props[tempAssoc[_sourceThing.props[i].name]] = _sourceThing.props[i];
         }
      }
      else {
         _destThing.props.push(_sourceThing.props[i]);
      }
   }

};

Gang.prototype.mergeThings = function(_sourceThings, _destThings, _override) {
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

Gang.prototype.mergeConfigs = function() {

   if (this.gangConfig.hasOwnProperty("things")) {

      if (this.config.hasOwnProperty("things")) {
         this.mergeThings(this.config.gangThings, this.gangConfig.things, false);
      }
      else {
         this.gangConfig.things = this.config.gangThings;
      }
   }
}

Gang.prototype.extractCasa = function() {
   var Casa = this.cleverRequire(this.config.type);
   var casaObj = new Casa(this.config, this);
   this.casa = casaObj;
   this.casa.db = this.dbs[casaObj.name];
   console.log('New casa: ' + casaObj.name);
}

Gang.prototype.coldStartThings = function() {

   for(var prop in this.things) {

      if (this.things.hasOwnProperty(prop)){
         console.log(this.uName + ': Cold starting thing ' + this.things[prop].uName);
         this.things[prop].coldStart();
      }
   }
}

Gang.prototype.createPeerCasa = function(_config, _anonymous) {
   console.log('Creating a peer casa for casa ' + _config.name);

   var PeerCasa = require('./peercasa');
   var peerCasa = new PeerCasa(_config, this);

   if (!_anonymous) {
      this.peerCasas[peerCasa.uName] = peerCasa;
   }

   return peerCasa;
};

Gang.prototype.addPeerCasa = function(_peerCasa, _force) {

   if (!_force && this.peerCasas[_peerCasa.uName]) {
      return false;
   }

   this.peerCasas[_peerCasa.uName] = _peerCasa;
   return true;
};

Gang.prototype.removePeerCasa = function(_peerCasa) {

   if (this.peerCasas[_peerCasa.uName]) {
      delete this.peerCasas[_peerCasa.uName];
      this.peerCasas[_peerCasa.uName] = null;
   }
};

Gang.prototype.findUser = function (_userName) {
   return this.users[_userName];
};

Gang.prototype.findPeerCasa = function (_casaName) {
   return this.peerCasas[_casaName];
};

Gang.prototype.findService = function(_serviceName) {
   return this.services[_serviceName];
};

Gang.prototype.inSecureMode = function() {
   return this.config.secureMode;
};

Gang.prototype.mainListeningPort = function() {
   return (this.casa) ? this.casa.listeningPort : 0
};

Gang.prototype.configPath = function() {
   return this.config.configPath;
};

Gang.prototype.certPath = function() {
   return this.config.certPath;
};

Gang.prototype.getDbs = function() {
   return [ this.name, this.casa.name ];
};

Gang.prototype.getDb = function(_dbName, _meta, _callback) {

   var dbName = (_dbName) ? _dbName : this.name;

   if (this.dbs.hasOwnProperty(dbName)) {

      if (_callback) {
         return _callback(null, this.dbs[dbName], _meta);
      }
      else {
         return this.dbs[dbName];
      }
   }
   else if (_callback) {
      var db = new Db(dbName, this.configPath(), false, this);

      if (this.dbCallbacks.hasOwnProperty(dbName)) {
         this.dbCallbacks[dbName].push({ meta: _meta, callback: _callback, db: db});
      }
      else {
         this.dbCallbacks[dbName] = [{ meta: _meta, callback: _callback, db: db}];
      }

      db.on('connected', (_data) => {

         if (this.dbCallbacks[_data.name]) {
            this.dbs[_data.name] = this.dbCallbacks[_data.name][0].db;

            for (var i = 0; i < this.dbCallbacks[_data.name].length; ++i) {
               var cb = this.dbCallbacks[_data.name][i].callback;
               var meta = this.dbCallbacks[_data.name][i].meta;
               cb(null, this.dbs[_data.name], meta);
            }
            delete this.dbCallbacks[_data.name];
         }
      });

      db.on('connect-error', (_data) => {

         if (this.dbCallbacks[_data.name]) {
            delete this.dbCallbacks[_data.name].db;

            for (var i = 0; i < this.dbCallbacks[_data.name].length; ++i) {
               var cb = this.dbCallbacks[_data.name][i].callback;
               var meta = this.dbCallbacks[_data.name][i].meta;
               cb(_data.error, null, meta);
            }
            delete this.dbCallbacks[_data.name];
         }
      });

      db.connect();
   }
   else {
      return null;
   }
};

Gang.mainInstance = function() {
   return _mainInstance;
};

Gang.prototype.addPeerCasa = function(_peerCasa) {
  this.peerCasas[_peerCasa.uName] = _peerCasa;
};

Gang.prototype.removePeerCasa = function(_peerCasa) {

  if (this.peerCasas.hasOwnProperty(_peerCasa.uName)) {
     delete this.peerCasas[_peerCasa.uName];
  }
};

Gang.prototype.findNewPeerSource = function(_peerSourceFullName, _peerCasa) {
   var topPriority = -1;
   var highestPrioritySource = null;

   for (var peerCasaName in this.peerCasas) {

      if (this.peerCasas.hasOwnProperty(peerCasaName) && (peerCasaName !== _peerCasa.uName)) {
         let newSource = this.peerCasas[peerCasaName].getSource(_peerSourceFullName);

         if (newSource) {

            if (newSource.priority > topPriority) {
               topPriority = newSource.priority;
               highestPrioritySource = newSource;
            }
         }
      }
   }
   return highestPrioritySource;
};

Gang.prototype.changePeerCasaName = function(_peerCasa, _newName) {

   if (this.peerCasas.hasOwnProperty(_peerCasa.uName)) {
      delete this.peerCasas[_peerCasa.uName];
   }
   this.peerCasas[_newName] = _peerCasa;
};

Gang.prototype.uNameToLongForm = function(_name)  {
   return ((_name.length === 1) && (_name[0] === ':')) ? this.casa.uName : ((_name.length > 1) && (_name[0] === ':') && (_name[1] !== ':')) ? this.casa.uName + _name : _name;
};

Gang.prototype.findNamedObject = function(_name)  {
   return NamedObject.prototype.findNamedObject.call(this, this.uNameToLongForm(_name));
};

module.exports = exports = Gang;

