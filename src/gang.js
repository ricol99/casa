var util = require('./util');
var S = require('string');
var Db = require('./db');
var NamedObject = require('./namedobject');

var _mainInstance = null;

function Gang(_casaName, _connectToPeers, _connectToParent, _secureMode, _certPath, _configPath, _version, _console) {
   this.casaName = "casa:" + _casaName;
   this.version = _version;
   this._id = true;	// TDB!!!

   this.uberCasa = false;
   this.users = [];
   this.scenes = {};
   this.things = {};
   this.topLevelThings = [];
   this.casaAreas = [];
   this.casa = null;
   this.peerCasas = [];
   this.parentCasa = null;
   this.remoteCasas = [];
   this.services = {};
   this.systemServices = {};

   this.casaArea = null;
   this.parentCasaArea = null;
   this.peerCasaArea = null;
   this.childCasaAreas = [];

   this.constructors = {};
   this.allObjects = [];

   this.areaId = 1;
   this.dbs = {};
   this.dbCallbacks = {};

   _mainInstance = this;
 
   var globalConsole = (_console) ? _console === "global" : false;
   var localConsole = (_console) ? _console === "local" : false;

   if (!globalConsole) {
      this.casaDb = new Db(this.casaName, _configPath);
      this.dbs[this.casaName] = this.casaDb;

      this.casaDb.on('connected', (_data) => {
         this.dbs[_data.name] = _data.db;

         this.loadConfig(this.casaDb, "casa", (_err, _res) => {

            if (_err) {
               console.error("Unable to load casa DB. Error=" + _err);
               process.exit(1);
            }

            this.config.connectToPeers = _connectToPeers;
            this.config.connectToParent = _connectToParent;
            this.config.secureMode = _secureMode;
            this.config.certPath = _certPath;
            this.config.configPath = _configPath;
            this.uName = this.config.gang;
            NamedObject.call(this, this.uName);
            this.allObjects[this.uName] = this;

            this.loadSystemServices();

            this.gangDb = new Db(this.uName, _configPath);
            this.dbs[this.uName] = this.gangDb;

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
      this.uName = "gang:"+_casaName;
      NamedObject.call(this, this.uName);
      this.casaName = "casa:console";

      this.config = { uName: this.casaName, secureMode: _secureMode, certPath: _certPath, configPath: _configPath, listeningPort: 8999 };
      this.extractCasa();
      var casaShortName = this.casaName.split(":")[1];
      this.extractServices([ { uName: "scheduleservice:"+casaShortName,  latitude:  51.5, longitude: -0.1, forecastKey: "5d3be692ae5ea4f3b785973e1f9ea520" },
                             { uName: "rampservice:"+casaShortName }, { uName: "dbservice:"+casaShortName } ], false, this.systemServices);

      this.gangDb = new Db(this.uName, _configPath);

      this.gangDb.on('connected', (_data) => {
         this.dbs[_data.name] = _data.db;
         var Console = require('./console');
         this.console = new Console({ gangName: this.uName, casaName: null, secureMode: _secureMode, certPath: _certPath });
         this.console.coldStart();
      });

      this.gangDb.on('connect-error', (_data) => {
         this.gangDb = new Db(this.uName, _configPath, true);

         this.gangDb.on('connected', (_data) => {
            this.dbs[_data.name] = _data.db;
            this.gangDb.appendToCollection("gang", { uName: this.uName, secureMode: _secureMode, certPath: _certPath, configPath: _configPath, listeningPort: 8999 });
            var Console = require('./console');
            this.console = new Console({ gangName: this.uName, casaName: null, secureMode: _secureMode, certPath: _certPath });
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

Gang.prototype.findNamedObject = function(_scope, _collections) {

   var scope = _scope.startsWith("::") ? _scope.substr(2) : _scope.startsWith(this.uName + ":") ? _scope.substr(this.uName.length+1) : (_scope === this.uName) ? "" : _scope;

   if (scope.trim().length === 0) {
      return this;
   }

   if (scope.startsWith(":")) {
      scope = this.casa.uName + scope;
   }
    
   console.log("AAAAA scope="+scope);
   return NamedObject.prototype.findNamedObject.call(this, scope, [ this.allObjects ]);
};

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
         config = this.gangConfig;
      }
      else {
         this.config = _mainConfig[0];
         config = this.config;
      }

      _db.readCollection("users", (_err, _users) => {

         if (!_err) {
            config.users = _users;
            this.markObjects(config.users, "_db", config.uName); 
         }

         _db.readCollection("services", (_err, _services) => {

            if (!_err) {
               config.services = _services;
               this.markObjects(config.sevices, "_db", config.uName); 
            }

            _db.readCollection("scenes", (_err, _scenes) => {

               if (!_err) {
                  config.scenes = _scenes;
                  this.markObjects(config.scenes, "_db", config.uName); 
               }

               _db.readCollection("things", (_err, _things) => {

                  if (!_err) {
                     config.things = _things;
                     this.markObjects(config.things, "_db", config.uName); 
                  }
                  _callback(null, true);
               });
            });
         });
      });
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
      this.localConsole = new LocalConsole();
      this.localConsole.coldStart();
   }

   // Extract Users
   this.extractUsers();

   // Extract Scenes
   this.extractScenes(this.config.scenes);

   // Extract Things
   this.extractThings(this.config.things);

   // Extract Parent casa of parent area
   this.extractParentCasa();

   // Create area for peer casas to live in
   this.createPeerCasaArea();

   // Make sure all listeners are refreshed now that all sources are available
   this.casa.refreshSourceListeners();

   // Cold start all defined things now that everything has been created
   this.coldStartThings();

   // start conecting to parent, if it exists
   if (this.config.connectToParent && this.parentCasa) {

      setTimeout( () => {
         this.parentCasa.connectToPeerCasa(this.config.parentCasa);
      }, 10000);
   }

   this.connectToPeers();
}

Gang.prototype.loadSystemServices = function(_dbCallback) {
   var casaShortName = this.casaName.split(":")[1];
   this.extractServices([ { uName: "scheduleservice:"+casaShortName,  latitude:  51.5, longitude: -0.1, forecastKey: "5d3be692ae5ea4f3b785973e1f9ea520" },
                          { uName: "rampservice:"+casaShortName }, { uName: "dbservice:"+casaShortName }, { uName: "consoleapiservice:"+casaShortName } ], true, this.systemServices);
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

Gang.prototype.addObjectToGlobalScope = function(_obj) {

   if (!_obj.owner) {
      this.allObjects[_obj.uName] = _obj;
      return true;
   }

   return false;
};

Gang.prototype.cleverRequire = function(_name, _path, _type) {
   var str = (_type) ? _type : S(_name).between('', ':').s;
   var path = '';

   if (_path && (_path !== str+'s')) {
      path = _path + '/';
   }

   if (!this.constructors[str]) {
      console.log('loading more code: ./' + str);

      try {
         this.constructors[str] = require('./' + path + str);
      }
      catch (_err) {
         //process.stderr.write(util.inspect(_err));
         return null;
      }
   }
   return this.constructors[str];
}

// Extract Users
Gang.prototype.createUser = function(_user) {
   var User = this.cleverRequire(_user.uName);
   _user.owner = this;
   var userObj = new User(_user);
   this.users[userObj.uName] = userObj;
   this.addObjectToGlobalScope(userObj);
   console.log('New user: ' + userObj.uName);
};

Gang.prototype.extractUsers = function() {

   if (this.config.users) {

      for (var i = 0; i < this.config.users.length; ++i) { 
         this.createUser(this.config.users[i]);
      };
   }
};

// Extract Services
Gang.prototype.createService = function(_config, _serviceOwner) {
   console.log('Loading service '+ _config.uName);
   var Service = this.cleverRequire(_config.uName, 'services', _config.type);

   if (!Service) {
      return null;
   }

   var serviceObj = new Service(_config);
   this.services[serviceObj.uName] = serviceObj;
   console.log('New service: ' + _config.uName);

   if (_serviceOwner) {
      _serviceOwner[serviceObj.uName] = serviceObj;
   }
   else {
      this.casa.addService(serviceObj);
      this.addObjectToGlobalScope(serviceObj);
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
         console.log('Cold starting service '+ this.services[serviceName].uName);
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
         var Scene = this.cleverRequire(_config[index].uName, 'scenes');
         var sceneObj = new Scene(_config[index]);
         this.scenes[sceneObj.uName] = sceneObj;
         this.addObjectToGlobalScope(sceneObj);
         console.log('New scene: ' + _config[index].uName);
      }
   }
}

// Extract Things
Gang.prototype.createThing = function(_config, _parent) {
   var Thing = this.cleverRequire(_config.uName, 'things', _config.type);

   if (!Thing) {
      return null;
   }

   var thingObj = new Thing(_config, _parent);
   this.things[thingObj.uName] = thingObj;

   if (!_parent) {
      this.addObjectToGlobalScope(thingObj);
   }
   console.log('New thing: ' + _config.uName);
   return thingObj;
};

Gang.prototype.removeThing = function(_thing) {
   delete this.things[_thing.uName];

   if (!_thing.owner) {
      delete this.allObjects[_thing.uName];
   }
};

Gang.prototype.extractThings = function(_config, _parent) {

   if (_config) {

      for (var index = 0; index < _config.length; ++index) {
         var thingObj = this.createThing(_config[index], _parent);

         if (_config[index].things) {
            this.extractThings(_config[index].things, thingObj);

            if (!_parent) {
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
      tempAssoc[_destThings[j].uName] = j;
   }

   for (var i = 0; i < _sourceThings.length; ++i) {

      if (tempAssoc.hasOwnProperty(_sourceThings[i].uName)) {
         this.mergeThing(_sourceThings[i], _destThings[tempAssoc[_sourceThings[i].uName]]);
      }
      else {
         _destThings.push(_sourceThings[i]);
      }
   }
};

Gang.prototype.mergeConfigs = function() {

   if (this.config.connectToParent) {
      this.config.parentCasa = this.gangConfig.parentCasa;
   }

   this.config.users = this.gangConfig.users;

   if (this.gangConfig.hasOwnProperty("services")) {

      if (!this.config.hasOwnProperty("services") || !this.config.services) {
         this.config.services = [];
      }

      for (var i = 0; i < this.gangConfig.services.length; ++i) {
         this.config.services.push(this.gangConfig.services[i]);
      }
   }

   if (this.gangConfig.hasOwnProperty("things")) {

      if (this.config.hasOwnProperty("things")) {
         this.mergeThings(this.gangConfig.things, this.config.things, false);
      }
      else {
         this.config.things = this.gangConfig.things;
      }

      //if (!this.config.hasOwnProperty("things") || !this.config.things) {
         //this.config.things = [];
      //}

      //for (var i = 0; i < this.gangConfig.things.length; ++i) {
         //this.config.things.push(this.gangConfig.things[i]);
      //}
   }
}

Gang.prototype.extractCasa = function() {
   var Casa = this.cleverRequire(this.config.uName);
   var casaObj = new Casa(this.config);
   this.allObjects[casaObj.uName] = casaObj;
   this.casa = casaObj;
   this.casa.db = this.dbs[casaObj.uName];
   console.log('New casa: ' + casaObj.uName);
}

Gang.prototype.extractParentCasa = function() {

   if (this.config.hasOwnProperty("parentCasa") && this.config.parentCasa) {
      this.config.parentCasa.loginAs = "child";
      this.config.parentCasa.persistent = true;

      var PeerCasa = require('./peercasa');
      this.parentCasa = new PeerCasa(this.config.parentCasa);
      this.remoteCasas[this.parentCasa.uName] = this.parentCasa;
      this.allObjects[this.parentCasa.uName] = this.parentCasa;
      console.log('New parentcasa: ' + this.parentCasa.uName);

      var ParentCasaArea = require('./parentcasaarea');
      this.parentCasaArea = new ParentCasaArea ({ uName: 'parentcasaarea:my-parent' });
      this.casaAreas[this.parentCasaArea.uName] = this.parentCasaArea;
      this.allObjects[this.parentCasaArea.uName] = this.parentCasaArea;
      console.log('New parentcasaarea: ' + this.parentCasaArea.uName);

      this.parentCasa.setCasaArea(this.parentCasaArea);
   }
}

Gang.prototype.coldStartThings = function() {

   for(var prop in this.things) {

      if (this.things.hasOwnProperty(prop)){
         console.log(this.uName + ': Cold starting thing ' + this.things[prop].uName);
         this.things[prop].coldStart();
      }
   }
}

Gang.prototype.createPeerCasaArea = function() {
   var PeerCasaArea = require('./peercasaarea');
   this.peerCasaArea= new PeerCasaArea({ uName: 'peercasaarea:my-peers' });
   this.casaAreas[this.peerCasaArea.uName] = this.peerCasaArea;
   this.allObjects[this.peerCasaArea.uName] = this.peerCasaArea;
}

Gang.prototype.createChildCasaArea = function(_casas) {
   var ChildCasaArea = require('./childcasaarea');
   var childCasaArea = new ChildCasaArea({ uName: 'childcasaarea:' + this.casa.uName + this.areaId});

   this.areaId = (this.areaId + 1) % 100000;

   this.casaAreas[childCasaArea.uName] = childCasaArea;
   this.childCasaAreas[childCasaArea.uName] = childCasaArea;
   this.allObjects[childCasaArea.uName] = childCasaArea;

   var len = _casas.length;

   for (var i = 0 ; i < len; ++i) {
      _casas[i].setArea(childCasaArea);
   }
   return childCasaArea;
}

Gang.prototype.findCasaArea = function(_areaName) {
   return this.casaAreas[_areaName];
}

Gang.prototype.deleteCasaArea = function(_area) {
   delete this.casaAreas[_area.uName];
   delete this.allObjects[_area.uName];
   delete this.childCasaAreas[_area.uName];

   if (_area == this.parentCasaArea) {
      this.parentCasaArea = null;
   }
   _area.removeAllCasas();

   delete _area;
}

Gang.prototype.resolveCasaAreasAndPeers = function(_casaName, _peers) {
   var knownPeerCasas = [];

   if (_peers) {
      var len = _peers.length;

      for (var i = 0 ; i < len; ++i) {

         if (this.remoteCasas[_peers[i]]) {
            knownPeerCasas.push(this.remoteCasas[_peers[i]]);
         }
      }
   }

   var len = knownPeerCasas.length;
   var peerAreas = [];

   for (i = 0 ; i < len; ++i) {

      if (knownPeerCasas[i].casaArea) {
         peerAreas.push(knownPeerCasas[i].casaArea);
      }
   }

   if (peerAreas.length == 0) {
      return this.createChildCasaArea(knownPeerCasas);
   }
   else if (peerAreas.length == 1) {
      return knownPeerCasas[0].casaArea;
   }
   else if (peerAreas.length > 1) {
      // set all casaAreas to the same, if they are not
     
      var len = knownPeerCasas.length;

      for (i = 0 ; i < len; ++i) {

         if (!knownPeerCasas[i].casaArea || knownPeerCasas[i].casaArea != peerAreas[0]) {
            knownPeerCasas[i].setCasaArea(peerAreas[0]);
         }
      }
      return peerAreas[0];
   }
}

Gang.prototype.createChildCasa = function(_config, _peers) {
   console.log('Creating a child casa for casa ' + _config.uName);

   var area = null;

   // Resolve area
   area = this.resolveCasaAreasAndPeers(_config.uName, _peers);

   var PeerCasa = require('./peercasa');
   var childCasa = new PeerCasa(_config);

   if (area) {
      childCasa.setCasaArea(area);
   }

   this.remoteCasas[childCasa.uName] = childCasa;
   this.allObjects[childCasa.uName] = childCasa;

   this.setUberCasa(true);
   return childCasa;
};

Gang.prototype.createPeerCasa = function(_config, _anonymous) {
   console.log('Creating a peer casa for casa ' + _config.uName);

   var PeerCasa = require('./peercasa');
   var peerCasa = new PeerCasa(_config);
   peerCasa.setCasaArea(this.peerCasaArea);

   if (!_anonymous) {
      this.remoteCasas[peerCasa.uName] = peerCasa;
      this.allObjects[peerCasa.uName] = peerCasa;
   }

   return peerCasa;
};

Gang.prototype.addRemoteCasa = function(_remoteCasa, _force) {

   if (!_force && this.remoteCasas[_remoteCasa.uName]) {
      return false;
   }

   this.remoteCasas[_remoteCasa.uName] = _remoteCasa;
   this.allObjects[_remoteCasa.uName] = _remoteCasa;
   return true;
};

Gang.prototype.removeRemoteCasa = function(_remoteCasa) {

   if (this.remoteCasas[_remoteCasa.uName]) {
      delete this.remoteCasas[_remoteCasa.uName];
      delete this.allObjects[_remoteCasa.uName];
      this.remoteCasas[_remoteCasa.uName] = null;
   }
};

Gang.prototype.findUser = function (_userName) {
   return this.users[_userName];
};

Gang.prototype.findRemoteCasa = function (_casaName) {
   return this.remoteCasas[_casaName];
};

Gang.prototype.findGlobalSource = function (_sourceName) {
   return this.allObjects[_sourceName];
};

Gang.prototype.findService = function(_serviceName) {
   return this.services[_serviceName];
};

Gang.prototype.setUberCasa = function(_uberCasa) {
   if (_uberCasa && !this.uberCasa) {
      // Becoming an uber casa
      this.uberCasa = _uberCasa;
   }
   else if (!_uberCasa && this.uberCasa) {
      // Losing uber casa status
      this.uberCasa = _uberCasa;
   }
};

Gang.prototype.isUberCasa = function() {
  return this.uberCasa;
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
   return [ this.uName, this.casa.uName ];
};

Gang.prototype.getDb = function(_dbName, _meta, _callback) {

   var dbName = (_dbName) ? _dbName : this.uName;

   if (this.dbs.hasOwnProperty(dbName)) {

      if (_callback) {
         return _callback(null, this.dbs[dbName], _meta);
      }
      else {
         return this.dbs[dbName];
      }
   }
   else if (_callback) {
      var db = new Db(dbName, this.configPath());

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

Gang.prototype.updateGangDbFromParent = function(_parentCasa) {
   var dbService = this.casa.findService("dbservice");

   dbService.updateGangDbFromPeer(_parentCasa.address.hostname, _parentCasa.address.port, (_err, _res) => {

      if (_err) {
         console.error(this.uName + ": Unable to update my gang db from parent. Error: " + _err);
         process.exit(2);
      }
      else {
         // Exit, we have to restart with new Db
         console.log(this.uName + ": Gang db updated from parent. Need to restart. Exiting....");
         process.exit(2);

         this.gangDb.close();
         this.gangDb = new Db(this.uName, this.configPath());

         this.gangDb.on('connected', () => {

            this.loadConfig(this.gangDb, "gang", (_err, _config) => {
            });

         });

         this.gangDb.connect();
      }
   });
};

Gang.prototype.addPeerCasa = function(_peerCasa) {
  this.peerCasas[_peerCasa.uName] = _peerCasa;
};

Gang.prototype.removePeerCasa = function(_peerCasa) {

  if (this.peerCasas.hasOwnProperty(_peerCasa.uName)) {
     delete this.peerCasas[_peerCasa.uName];
  }
};

Gang.prototype.findNewPeerSource = function(_peerSourceName, _peerCasa) {
   var topPriority = -1;
   var highestPrioritySource = null;

   for (var peerCasaName in this.peerCasas) {

      if (this.peerCasas.hasOwnProperty(peerCasaName) && (peerCasaName !== _peerCasa.uName)) {
         let newSource = this.peerCasas[peerCasaName].getSource(_peerSourceName);

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

Gang.prototype.filterGlobalObjects = function(_filter) {
   var hits = [];

   for (var obj in this.allObjects) {

      if (this.allObjects[obj].uName.startsWith(_filter)) {
         hits.push(this.allObjects[obj].uName);
      }
   }

   return hits;
};

module.exports = exports = Gang;

