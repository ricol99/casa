var util = require('./util');
var S = require('string');
var Db = require('./db');

var _mainInstance = null;

function Gang(_casaName, _connectToPeers, _connectToParent, _secureMode, _certPath, _configPath, _version) {
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

   this.casaArea = null;
   this.parentCasaArea = null;
   this.peerCasaArea = null;
   this.childCasaAreas = [];

   this.constructors = {};
   this.allObjects = [];

   this.areaId = 1;

   _mainInstance = this;

   this.casaDb = new Db(this.casaName, _configPath);

   this.casaDb.on('connected', () => {

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
         this.loadSystemServices();

         this.gangDb = new Db(this.uName, _configPath);

         this.gangDb.on('connected', () => {

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
                              this.init();
                           }
                        });
                     }
                  });
               }
               else {
                  this.init();
               }
            });
         });
      });
   });
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

Gang.prototype.init = function() {
   
   // Merge Configs
   this.mergeConfigs();

   // Extract Casa
   this.extractCasa();

   // Extract Services
   this.extractServices(this.config.services);

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
   this.extractServices([ { uName: "scheduleservice",  latitude:  51.5, longitude: -0.1, forecastKey: "5d3be692ae5ea4f3b785973e1f9ea520" },
                          { uName: "rampservice" }, { uName: "dbservice" } ], true);
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

Gang.prototype.cleverRequire = function(_name, _path) {
   var str = S(_name).between('', ':').s;
   var path = '';

   if (_path && (_path !== str+'s')) {
      path = _path + '/';
   }

   if (!this.constructors[str]) {
      console.log('loading more code: ./' + str);
      this.constructors[str] = require('./' + path + str);
   }
   return this.constructors[str];
}

// Extract Users
Gang.prototype.extractUsers = function() {

   if (this.config.users) {

      this.config.users.forEach( (user) => { 
         var User = this.cleverRequire(user.uName);
         user.owner = this;
         var userObj = new User(user);
         this.users[userObj.uName] = userObj;
         this.allObjects[userObj.uName] = userObj;
         console.log('New user: ' + userObj.uName);
      });
   }
};

Gang.prototype.extractServices = function(_config, _noColdStart) {

   if (_config) {
      console.log('Extracting services...');

      for (var index = 0; index < _config.length; ++index) {
         console.log('Loading service '+ _config[index].uName);
         var Service = require('./services/'+_config[index].uName);
         this.services[_config[index].uName] = new Service(_config[index]);
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
         this.allObjects[sceneObj.uName] = sceneObj;
         console.log('New scene: ' + _config[index].uName);
      }
   }
}

// Extract Things
Gang.prototype.createThing = function(_config, _parent) {
   var Thing = this.cleverRequire(_config.uName, 'things');
   var thingObj = new Thing(_config);
   thingObj.setParent(_parent);
   this.things[thingObj.uName] = thingObj;
   this.allObjects[thingObj.uName] = thingObj;
   console.log('New thing: ' + _config.uName);
   return thingObj;
};

Gang.prototype.removeThing = function(_thing) {
   delete this.things[_thing.uName];
   delete this.allObjects[_thing.uName];
};

Gang.prototype.extractThings = function(_config, _parent) {

   if (_config) {

      for (var index = 0; index < _config.length; ++index) {
         var thingObj = this.createThing(_config[index], _parent);

         if (_config[index].things) {

            if (_parent == undefined) {
               this.topLevelThings.push(thingObj);
            }
            this.extractThings(_config[index].things, thingObj);
         }
      }
   }
}

Gang.prototype.mergeConfigs = function() {

   if (this.config.connectToParent) {
      this.config.parentCasa = this.gangConfig.parentCasa;
   }

   this.config.users = this.gangConfig.users;

   if (this.gangConfig.services) {

      if (!this.config.services) {
         this.config.services = [];
      }

      for (var i = 0; i < this.gangConfig.services.length; ++i) {
         this.config.services.push(this.gangConfig.services[i]);
      }
   }

   if (this.gangConfig.things) {

      if (!this.config.things) {
         this.config.things = [];
      }

      for (var i = 0; i < this.gangConfig.things.length; ++i) {
         this.config.things.push(this.gangConfig.things[i]);
      }
   }
}

Gang.prototype.extractCasa = function() {
   var Casa = this.cleverRequire(this.config.uName);
   var casaObj = new Casa(this.config);
   this.allObjects[casaObj.uName] = casaObj;
   this.casa = casaObj;
   console.log('New casa: ' + casaObj.uName);
}

Gang.prototype.extractParentCasa = function() {

   if (this.config.parentCasa) {
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

Gang.prototype.addRemoteCasa = function(_remoteCasa) {

   if (this.remoteCasas[_remoteCasa.uName]) {
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

Gang.prototype.findSource = function (_sourceName) {
   return this.allObjects[_sourceName];
};

Gang.prototype.findService = function(_serviceName) {
   return this.services[_serviceName];
};

Gang.prototype.resolveObject = function (objName) {
    return this.allObjects[objName];
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

Gang.mainInstance = function() {
   return _mainInstance;
};

Gang.prototype.updateGangDbFromParent = function(_parentCasa) {
   var dbService = this.findService("dbservice");

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
      }
   });
};

module.exports = exports = Gang;

