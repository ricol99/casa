var util = require('./util');
var S = require('string');
var Db = require('./db');
var NamedObject = require('./namedobject');
var Casa = require('./casa');

var _mainInstance = null;

function Gang(_config) {
   NamedObject.call(this, _config);
   this.peercasas = {};

   _mainInstance = this;
   this.casa = new Casa(_config.casa, this);
};

util.inherits(Gang, NamedObject);

// Used to classify the type and understand where to load the javascript module
Gang.prototype.superType = function(_type) {
   return "gang";
};

Gang.prototype.buildTree = function() {
   this.createChildren(this.config.users, "user", this);
   this.createChildren(this.config.things, "thing", this);

   this.casa.buildTree();

   this.init();
};

Gang.prototype.getCasa = function() {
   return this.casa;
};

Gang.prototype.interestInNewChild = function(_uName) {
};

Gang.prototype.init = function() {

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].inheritChildProps();
      }
   }

   this.casa.coldStartServices();

   // Make sure all listeners are refreshed now that all sources are available
   this.casa.refreshSourceListeners();

   // Cold start all defined things now that everything has been created
   this.coldStart();
   this.casa.coldStart();

   // Start connecting to Peers
   this.connectToPeers();
}

Gang.prototype.connectToPeers = function() {

   if (this.casa.connectToPeers) {

      setTimeout( (_dbCallback_) => {
         this.casa.startListening();
         var PeerCasaService = require('./peercasaservice');
         this.peerCasaService = new PeerCasaService({ gang: this.name, fetchDbMode: false });
      }, 20000 + Math.floor(Math.random(20000)), _dbCallback);
   }
};

Gang.prototype.removeThing = function(_thing) {
   this.removeChildNamedObject(_thing);
};

Gang.prototype.coldStart = function() {

   for(var prop in this.things) {

      if (this.things.hasOwnProperty(prop)){
         console.log(this.uName + ': Cold starting thing ' + this.things[prop].uName);
         this.things[prop].coldStart();
      }
   }
}

Gang.prototype.createPeerCasa = function(_config, _anonymous) {
   console.log('Creating a peer casa for casa ' + _config.name);

   var peerCasa = this.createChild(_config, "peercasa", this);

   if (_anonymous) {
      delete this.peercasas[peerCasa.uName];
   }

   return peerCasa;
};

Gang.prototype.addPeerCasa = function(_peerCasa, _force) {

   if (!_force && this.peercasas[_peerCasa.uName]) {
      return false;
   }

   this.peercasas[_peerCasa.uName] = _peerCasa;
   return true;
};

Gang.prototype.removePeerCasa = function(_peerCasa) {

   if (this.peercasas[_peerCasa.uName]) {
      delete this.peercasas[_peerCasa.uName];
      this.peercasas[_peerCasa.uName] = null;
   }
};

Gang.prototype.findUser = function (_userName) {
   return this.users[_userName];
};

Gang.prototype.findPeerCasa = function (_casaName) {
   return this.peercasas[_casaName];
};

Gang.prototype.findService = function(_serviceName) {
   return this.services[_serviceName];
};

Gang.prototype.inSecureMode = function() {
   return this.casa.secureMode;
};

Gang.prototype.mainListeningPort = function() {
   return (this.casa) ? this.casa.listeningPort : 0
};

Gang.prototype.configPath = function() {
   return this.casa.configPath;
};

Gang.prototype.certPath = function() {
   return this.casa.certPath;
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
  this.peercasas[_peerCasa.uName] = _peerCasa;
};

Gang.prototype.removePeerCasa = function(_peerCasa) {

  if (this.peercasas.hasOwnProperty(_peerCasa.uName)) {
     delete this.peercasas[_peerCasa.uName];
  }
};

Gang.prototype.findNewPeerSource = function(_peerSourceFullName, _peerCasa) {
   var topPriority = -1;
   var highestPrioritySource = null;

   for (var peerCasaName in this.peercasas) {

      if (this.peercasas.hasOwnProperty(peerCasaName) && (peerCasaName !== _peerCasa.uName)) {
         let newSource = this.peercasas[peerCasaName].getSource(_peerSourceFullName);

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

   if (this.peercasas.hasOwnProperty(_peerCasa.uName)) {
      delete this.peercasas[_peerCasa.uName];
   }
   this.peercasas[_newName] = _peerCasa;
};

Gang.prototype.uNameToLongForm = function(_name)  {
   return ((_name.length === 1) && (_name[0] === ':')) ? this.casa.uName : ((_name.length > 1) && (_name[0] === ':') && (_name[1] !== ':')) ? this.casa.uName + _name : _name;
};

Gang.prototype.findNamedObject = function(_uName)  {
   var uName = this.uNameToLongForm(_uName);
   var namedObj = NamedObject.prototype.findNamedObject.call(this, uName);

   if (!namedObj) {
      var owner = this.findOwner(uName);

      if (owner && owner.casa) {
         owner.interestInNewChild(uName);
      }
   }

   return namedObj;
};

module.exports = exports = Gang;

