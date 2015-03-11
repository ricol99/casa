var util = require('util');
var S = require('string');
var Thing = require('./thing');

var _mainInstance = null;

function CasaSystem(_config) {
   this.casaName = _config.name;
   this.config = _config;
   this.uberCasa = false;
   this.users = [];
   this.areas = [];
   this.casa = null;
   this.peerCasas = [];
   this.parentCasa = null;
   this.remoteCasas = [];

   this.casaArea = null;
   this.childCasaAreas = [];

   this.constructors = {};
   this.allObjects = [];

   Thing.call(this, _config);

   var that = this;
   _mainInstance = this;

   // Extract Users
   this.extractUsers();

   // Extract My Casa
   this.extractCasa();

   // Extract Parent casa of parent area
   this.extractParentCasa();

   // Extract all states hosted by this casa
   this.extractCasaStates();

   // Extract all activators hosted by this casa
   this.extractCasaActivators();

   // Extract all actions hosted by this casa
   this.extractCasaActions();

   // start conecting to parent, if it exists
   if (this.parentCasa) {
      this.parentCasa.start();
   }

   var PeerCasaFactory = require('./peercasafactory');
   this.peerCasaFactory = new PeerCasaFactory({ gang: 'casa-collin' });
}

util.inherits(CasaSystem, Thing);

CasaSystem.prototype.cleverRequire = function(_name) {
   var str = S(_name).between('', ':').s;

   if (!this.constructors[str]) {
      console.log('loading more code: ./' + str);
      this.constructors[str] = require('./' + str);
   }
   return this.constructors[str];
}

// Extract Users
CasaSystem.prototype.extractUsers = function() {
   var that = this;

   if (this.config.users) {

      this.config.users.forEach(function(user) { 
         var User = that.cleverRequire(user.name);
         user.owner = that;
         var userObj = new User(user);
         that.users[userObj.name] = userObj;
         that.allObjects[userObj.name] = userObj;
         console.log('New user: ' + user.name);
      });
   }
}

CasaSystem.prototype.extractCasa = function() {
   var Casa = this.cleverRequire(this.config.name);
   var casaObj = new Casa(this.config);
   this.allObjects[casaObj.name] = casaObj;
   this.casa = casaObj;
   console.log('New casa: ' + casaObj.name);
}

CasaSystem.prototype.extractParentCasa = function() {

   if (this.config.parentCasa) {
      var ParentCasa = require('./parentcasa');
      this.config.casa = this.casa.name;
      this.parentCasa = new ParentCasa(this.config.parentCasa);
      this.allObjects[this.parentCasa.name] = this.parentCasa;
      console.log('New parentcasa: ' + this.parentCasa.name);
   }
}

CasaSystem.prototype.extractCasaStates = function() {
   var that = this;

   this.config.states.forEach(function(state) { 
      var State = that.cleverRequire(state.name);
      state.casa = that.casa.name;
      var stateObj = new State(state);
      that.allObjects[stateObj.name] = stateObj;
      console.log('New state: ' + state.name);
   });
}

CasaSystem.prototype.extractCasaActivators = function() {
   var that = this;

   this.config.activators.forEach(function(activator) { 
      var Activator = that.cleverRequire(activator.name);
      activator.casa = that.casa.name;
      var activatorObj = new Activator(activator);
      that.allObjects[activatorObj.name] = activatorObj;
      console.log('New activator: ' + activator.name);
   });
}

CasaSystem.prototype.extractCasaActions = function() {
   var that = this;

   this.config.actions.forEach(function(action) { 
      var Action = that.cleverRequire(action.name);
      action.casa = that.casa.name;
      var actionObj = new Action(action);
      that.allObjects[actionObj.name] = actionObj;
      console.log('New action: ' + action.name);
   });
}

CasaSystem.prototype.findUser = function (_userName) {
   return this.users[_userName];
}

CasaSystem.prototype.findRemoteCasa = function (_casaName) {
   return this.remoteCasas[_casaName];
}

CasaSystem.prototype.findCasaState = function (_casa, _stateName) {
   return _casa.states[_stateName];
}

CasaSystem.prototype.findOrCreateCasaState = function (casa, stateName) {

   var source = this.findCasaState(casa, stateName);

   // TBD 
   if (false) { // !source) {

      // Create a peer state
      var ret = this.findConfigState(stateName);

      if (ret) {
         var peerCasaName = ret.owner;
         var sourceName  = ret.name;

         var peerCasa = this.findRemoteCasa(peerCasaName);

         if (!peerCasa && this.parentCasaArea) {
            peerCasa = this.parentCasaArea.casas['UBER'];
         }

         if (peerCasa) {
            source = this.findCasaState(peerCasa, stateName);

            if (!source) {
               var PeerState = require('./peerstate');
               source = new PeerState(sourceName, peerCasa);
               this.allObjects[source.name] = source;
            }
         }
      }
   }

   return source;
}

CasaSystem.prototype.findState = function (stateName) {
   return this.findCasaState(this.casa, stateName);
}

CasaSystem.prototype.findOrCreateState = function (stateName) {
   var state = this.resolveObject(stateName);

   // TBD
   if (false) { // (!state) {
      var configState = this.findConfigState(stateName);

      if (configState) {
         state = this.findOrCreateCasaState(this.findRemoteCasa(configState.owner), stateName);
      }
   }
   return state;
}

CasaSystem.prototype.findCasaActivator = function (_casa, _activatorName) {
   return _casa.activators[_activatorName];
}

CasaSystem.prototype.findOrCreateCasaActivator = function (casa, activatorName) {

   var source = this.findCasaActivator(casa, activatorName);

   // TBD
   if (false) { // !source) {
      // Create a peer activator
      var ret = this.findConfigActivator(activatorName);

      if (ret) {
         var peerCasaName = ret.owner;
         var sourceName  = ret.name;

         var peerCasa = this.findRemoteCasa(peerCasaName);
         source = this.findCasaActivator(peerCasa, activatorName);

         if (!source) {
            var PeerActivator = require('./peeractivator');
            source = new PeerActivator(sourceName, peerCasa);
            this.allObjects[source.name] = source;
         }
      }
   }

   return source;
}

CasaSystem.prototype.findActivator = function (activatorName) {
   return findCasaActivator(this.casa, activatorName);
}

CasaSystem.prototype.findSource = function (sourceName) {

   // Resolve source
   var source = this.findOrCreateCasaState(this.casa, sourceName);

   if (!source) {
      source = this.findOrCreateCasaActivator(this.casa, sourceName);
   }

   if (!source) {
      source = this.findRemoteCasa(sourceName);
   }

   return source;
}

CasaSystem.prototype.findConfigState = function (stateName) {
   var that = this;

   var source = null;
   this.config.areas.forEach(function(configArea, index) { 
      var casaLen = configArea.casas.length;

      for (var i=0; i < casaLen; ++i) {
         var stateLen = configArea.casas[i].states.length;

         for (var j=0; j < stateLen; ++j) {

            if (configArea.casas[i].states[j].name == stateName) {
               console.log('Found the config state ' + configArea.casas[i].states[j].name);
               configArea.casas[i].states[j].owner = configArea.casas[i].name;
               source = configArea.casas[i].states[j];
               break;
            }
         }
      }
   });

   return source;
}

CasaSystem.prototype.findConfigActivator = function (activatorName) {
   var that = this;

   var source = null;
   this.config.areas.forEach(function(configArea, index) { 
      var casaLen = configArea.casas.length;

      for (var i=0; i < casaLen; ++i) {
         var activatorLen = configArea.casas[i].activators.length;

         for (var j=0; j < activatorLen; ++j) {

            if (configArea.casas[i].activators[j].name == activatorName) {
               console.log('Found the config activator ' + configArea.casas[i].activators[j].name);
               configArea.casas[i].activators[j].owner = configArea.casas[i].name;
               source = configArea.casas[i].activators[j];
               break;
            }
         }
      }
   });

   return source;
}

CasaSystem.prototype.resolveObject = function (objName) {
    return this.allObjects[objName];
}

CasaSystem.prototype.isUberCasa = function() {
  return this.uberCasa;
}

CasaSystem.mainInstance = function() {
   return _mainInstance;
}

module.exports = exports = CasaSystem;

