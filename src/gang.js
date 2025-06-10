var util = require('./util');
var S = require('string');
var Db = require('./db');
var NamedObject = require('./namedobject');
var Casa = require('./casa');

var _mainInstance = null;

function Gang(_config, _loader) {
   NamedObject.call(this, _config);
   this.dbCallbacks = {};
   this.peercasas = {};
   this.loader = _loader;

   this.casa = new Casa(_config.casa, this);
};

util.inherits(Gang, NamedObject);

// Used to classify the type and understand where to load the javascript module
Gang.prototype.superType = function(_type) {
   return "gang";
};

// Called when system state is required
Gang.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   _exportObj.casa = this.casa.name;
   _exportObj.config = stripTransient(this.config);
};

// Called to import system state before hot start
Gang.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
};

Gang.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);

   // Start connecting to Peers
   this.connectToPeers();
};

Gang.prototype.coldStart = function() {

   // Cold start the services
   this.casa.coldStartServices();

   // Make sure all listeners are refreshed now that all sources are available
   this.casa.refreshSourceListeners();

   // Cold start all defined things now that everything has been created
   for(var prop in this.things) {

      if (this.things.hasOwnProperty(prop)){
         console.log(this.uName + ': Cold starting thing ' + this.things[prop].uName);
         this.things[prop].coldStart();
      }
   }

   this.casa.coldStart();

   // Start connecting to Peers
   this.connectToPeers();
};

Gang.prototype.suspend = function() {
   return this.loader.suspend();
};

Gang.prototype.buildTree = function() {
   _mainInstance = this;
   this.casa.buildServices();

   var oldConfig = util.copy(this.config, true);

   this.createChildren(this.config.users, "user", this);
   this.createChildren(this.config.things, "thing", this);

   this.casa.buildTree();
};

Gang.prototype.getCasa = function() {
   return this.casa;
};

Gang.prototype.interestInNewChild = function(_uName) {
};
Gang.prototype.connectToPeers = function() {

   if (this.casa.connectToPeers) {

      setTimeout( () => {
         this.casa.startListening();
      }, 20000 + Math.floor(Math.random(20000)));
   }
};

Gang.prototype.removeThing = function(_thing) {
   this.removeChildNamedObject(_thing);
};

Gang.prototype.createPeerCasa = function(_name) {
   console.log('Creating a peer casa for casa ' + _name);

   var config = { name: _name, type: "peercasa"};
   var peerCasa = this.createChild(config, "peercasa", this);

   return peerCasa;
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
   return [ this.name+"-db", this.casa.name+"-db" ];
};

Gang.prototype.getDb = function(_dbName, _meta, _callback) {
   var dbName = (_dbName) ? _dbName : this.name+"-db";

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

Gang.prototype.removePeerCasa = function(_peerCasa) {
  this.removeChildNamedObject(_peerCasa);
};

Gang.prototype.findNewPeerSource = function(_peerSourceFullName, _peerCasa) {
   var topPriority = -1;
   var highestPrioritySource = null;

   for (var peerCasaName in this.peercasas) {

      if (this.peercasas.hasOwnProperty(peerCasaName) && (peerCasaName !== _peerCasa.name)) {
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

function diffObj(_obj1, _obj2) {

   if (_obj1 instanceof Array) {

      if (_obj2 instanceof Array) {

         if (_obj1.length === _obj2.length) {

            for (var i = 0; i < _obj1.length; ++i) {
               diffObj(_obj1[i], _obj2[i]);
            }
            return null;
         }
         else if (_obj1.length < _obj2.length) {

            for (var i = 0; i < _obj1.length; ++i) {
               diffObj(_obj1[i], _obj2[i]);
            }

            for (; i < _obj2.length; ++i) {

               if (typeof _obj2[i] === 'object') {

                  if (!(_obj2[i].hasOwnProperty("transient") && _obj2[i].transient)) {
                     console.log(">> "+JSON.stringify(_obj2[i]));
                  }
               }
               else {
                  diffObj(_obj1[i], _obj2[i]);
               }
            }
         }
         else {

            for (var i = 0; i < _obj2.length; ++i) {
               diffObj(_obj1[i], _obj2[i]);
            }

            for (; i < _obj1.length; ++i) {

               if (typeof _obj1[i] === 'object') {

                  if (!(_obj1[i].hasOwnProperty("transient") && _obj1[i].transient)) {
                     console.log("<< "+JSON.stringify(_obj1[i]));
                  }
               }
               else {
                  console.log("<< "+JSON.stringify(_obj1[i]));
               }
            }
         }
      }
      else {
         console.log("<< "+JSON.stringify(_obj1));
         console.log(">> "+JSON.stringify(_obj2));
      }
   }
   else if (typeof _obj1 === 'object') {

      if (typeof _obj2 === 'object') {

         if ((_obj1.hasOwnProperty("transient") && _obj1.transient) &&
             (_obj2.hasOwnProperty("transient") && _obj2.transient)) {

            return null;
         }

         for (var mem in _obj2) {

            if (_obj1.hasOwnProperty(mem) && _obj2.hasOwnProperty(mem)) {
               diffObj(_obj1[mem], _obj2[mem]);
            }
            else {
               console.log("<< "+JSON.stringify(_obj1));
               console.log(">> "+JSON.stringify(_obj2));
            }
         }
         return null;
      }
      else {
         console.log("<< "+JSON.stringify(_obj1));
         console.log(">> "+JSON.stringify(_obj2));
      }
   }
   else {
      if (_obj1 !== _obj2) {
         console.log("<< "+JSON.stringify(_obj1));
         console.log(">> "+JSON.stringify(_obj2));
      }
   }
}

function stripTransient(_source) {
   var dest;

   if (_source instanceof Array) {
      dest = [];

      for (var i = 0; i < _source.length; ++i) {

         if (_source[i] && (typeof _source[i] === 'object') && _source[i].hasOwnProperty("transient") && _source[i].transient) {
            continue;
         }

         dest.push(stripTransient(_source[i]));
      }

      return dest;
   }
   else if (typeof _source === 'object') {
      dest = {};

      for (var mem in _source) {

         if (_source[mem] && (typeof _source[mem] === 'object') && _source[mem].hasOwnProperty("transient") && _source[mem].transient) {
            continue;
         }

         dest[mem] = stripTransient(_source[mem]);
      }
      return dest;
   }
   else {
      dest = _source;
   }

   return dest;
}

module.exports = exports = Gang;

