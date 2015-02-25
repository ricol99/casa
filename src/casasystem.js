var util = require('util');
var S = require('string');
var Thing = require('./thing');

var _mainInstance = null;

function CasaSystem(_casaName, _config) {
   this.casaName = _casaName;
   this.config = _config;
   this.users = [];
   this.areas = [];
   this.casa = null;
   this.configCasaArea = null;
   this.configCasa = null;
   this.casaArea = null;
   this.constructors = {};
   this.allObjects = [];

   Thing.call(this, _config.name, _config.displayName, null, _config.props);

   var that = this;
   _mainInstance = this;

   // Extract Users
   this.config.users.forEach(function(user) { 
      var User = that.cleverRequire(user.name);
      user.owner = that;
      var userObj = new User(user);
      that.users.push(userObj);
      that.allObjects[userObj.name] = userObj;
      console.log('New user: ' + user.name);
   });

   // Extract Casa Areas
   this.config.areas.forEach(function(area) { 
      var Area = that.cleverRequire(area.name);
      area.owner = that;
      var areaObj = new Area(area);
      that.areas.push(areaObj);
      that.allObjects[areaObj.name] = areaObj;
      console.log('New area: ' + area.name);
   });

   // Extract Casa
   this.config.areas.forEach(function(area, index) { 
      that.areas[index].casas = [];
      var casaLen = area.casas.length;

      console.log('casas: ' + casaLen);

      for (var j=0; j < casaLen; ++j) {

         if (that.casaName == area.casas[j].name) {
            // Found myself! Build me!
            var Casa = that.cleverRequire(that.casaName);
            area.casas[j].casaArea = that.areas[index];
            area.casas[j].parentCasaArea = that.findCasaArea(area.parentArea);
            var casaObj = new Casa(area.casas[j]);
            that.areas[index].casas.push(casaObj);
            that.allObjects[casaObj.name] = casaObj;
            that.casa = casaObj;
            that.casa.states = [];
            that.casa.activators = [];
            that.configCasa = area.casas[j];
            that.configCasaArea = area;
            that.casaArea = that.areas[index];
            console.log('New casa: ' + casaObj.name);
            break;
         }
      }
   });

   
   // Extract Peer Casas for area
   var configArea = this.configCasaArea;
   var casaLen = configArea.casas.length;
   var proActiveConnect = false;

   for (var j=0; j < casaLen; ++j) {

      if (!configArea.casas[j].casaArea) {
         // Found a Peer Casa to create!
         var PeerCasa = this.cleverRequire('peer' + this.casaName);
         configArea.casas[j].casaArea = this.casa.casaArea;
         configArea.casas[j].casa = this.casa;
         configArea.casas[j].proActiveConnect = proActiveConnect;
         var casaObj = new PeerCasa(configArea.casas[j]);
         casaObj.states = [];
         casaObj.activators = [];
         this.casa.casaArea.casas.push(casaObj);
         this.allObjects[casaObj.name] = casaObj;
         console.log('New peercasa: ' + casaObj.name);
      }
      else {
         proActiveConnect = true;
      }
   }

   // Extract Peer casa of parent area
   var parentCasaArea = this.findCasaArea(configArea.parentArea);

   if (parentCasaArea) {
      var len = this.config.areas.length;

      for (var j=0; j < len; ++j) {
         console.log('area: ' + this.config.areas[j].name + '  ==  area: ' + configArea.parentArea);

         if (this.config.areas[j].name == configArea.parentArea) {
            // found parent area
            var PeerCasa = this.cleverRequire('peer' + this.config.areas[j].casas[0].name);
            this.config.areas[j].casas[0].casaArea = this.areas[j];
            this.config.areas[j].casas[0].casa = this.casa;
            this.config.areas[j].casas[0].proActiveConnect = true;
            var casaObj = new PeerCasa(this.config.areas[j].casas[0]);
            casaObj.states = [];
            casaObj.activators = [];
            this.areas[j].casas.push(casaObj);
            this.allObjects[casaObj.name] = casaObj;
            console.log('New peercasa: ' + casaObj.name);
         } 
      }
   }

   // If casa is a parent casa (position 0 of an area), extract children peer casas in child area
   if (this.configCasaArea.casas[0].name == this.casa.name) {
      var areaLen = this.areas.length;

      for (var area = 0; area < areaLen; ++area) {
         if (this.config.areas[area].parentArea == this.casa.casaArea.name) {
            var casaLen = this.config.areas[area].casas.length;

            for (var j=0; j < casaLen; ++j) {
               var PeerCasa = this.cleverRequire('peer' + this.config.areas[area].casas[j].name);
               this.config.areas[area].casas[j].casaArea = this.areas[area];
               this.config.areas[area].casas[j].casa = this.casa;
               this.config.areas[area].casas[j].proActiveConnect = false;
               var casaObj = new PeerCasa(this.config.areas[area].casas[j]);
               casaObj.states = [];
               casaObj.activators = [];
               this.areas[area].casas.push(casaObj);
               this.allObjects[casaObj.name] = casaObj;
               console.log('New peercasa: ' + casaObj.name);
            }
         }
      }
   }

   // Extract States
   this.configCasa.states.forEach(function(state) { 
      var State = that.cleverRequire(state.name);
      state.casa = that.casa.name;
      var stateObj = new State(state);
      that.casa.states.push(stateObj);
      that.allObjects[stateObj.name] = stateObj;
      console.log('New state: ' + state.name);
   });

   // Extract Activators
   this.configCasa.activators.forEach(function(activator) { 
      var Activator = that.cleverRequire(activator.name);
      activator.casa = that.casa.name;
      var activatorObj = new Activator(activator);
      that.casa.activators.push(activatorObj);
      that.allObjects[activatorObj.name] = activatorObj;
      console.log('New activator: ' + activator.name);
   });


   // Extract Actions
   this.casa.actions = [];

   this.configCasa.actions.forEach(function(action) { 
      var Action = that.cleverRequire(action.name);
      action.owner = that.casa;
      var actionObj = new Action(action);
      that.casa.actions.push(actionObj);
      that.allObjects[actionObj.name] = actionObj;
      console.log('New action: ' + action.name);
   });
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

CasaSystem.prototype.findUser = function (userName) {
   len = this.users.length;

   for (var i=0; i < len; ++i) {
      if (this.users[i].name == userName)
         return this.users[i];
   }

   return null;
}

CasaSystem.prototype.findCasaArea = function (areaName) {
   len = this.areas.length;

   for (var i=0; i < len; ++i) {
      if (this.areas[i].name == areaName)
         return this.areas[i];
   }

   return null;
}

CasaSystem.prototype.findCasa = function (casaName) {
   areaLen = this.areas.length;

   for (var i=0; i < areaLen; ++i) {

      casaLen = this.areas[i].casas.length;

      for (var j=0; j < casaLen; ++j) {
         if (this.areas[i].casas[j].name == casaName)
            return this.areas[i].casas[j];
      }
   }

   return null;
}

CasaSystem.prototype.findCasaState = function (casa, stateName) {
   var source = null;
   var len = casa.states.length;

   for (var i=0; i < len; ++i) {
      if (casa.states[i].name == stateName) {
         source = casa.states[i];
         break;
      }
   }
   return source;
}

CasaSystem.prototype.findOrCreateCasaState = function (casa, stateName) {

   var source = this.findCasaState(casa, stateName);

   if (!source) {
      // Create a peer state
      var ret = this.findConfigState(stateName);

      if (ret) {
         var peerCasaName = ret.owner;
         var sourceName  = ret.name;

         var peerCasa = this.findCasa(peerCasaName);
         source = this.findCasaState(peerCasa, stateName);

         if (!source) {
            var PeerState = require('./peerstate');
            source = new PeerState(sourceName, peerCasa);
            this.allObjects[source.name] = source;
         }
      }
   }

   return source;
}

CasaSystem.prototype.findState = function (stateName) {
   return this.findCasaState(this.casa, stateName);
}

CasaSystem.prototype.findOrCreateState = function (stateName) {
   var state = resolveObject(stateName);

   if (!state) {
      var configState = findConfigState(stateName);

      if (configState) {
         state = findOrCreateCasaState(findCasa(configState.owner), stateName);
      }
   }
   return state;
}

CasaSystem.prototype.findCasaActivator = function (casa, activatorName) {
   var source = null;
   var len = casa.activators.length;

   for (var i=0; i < len; ++i) {
      if (casa.activators[i].name == activatorName) {
         source = casa.activators[i];
         break;
      }
   }
   return source;
}

CasaSystem.prototype.findOrCreateCasaActivator = function (casa, activatorName) {

   var source = this.findCasaActivator(casa, activatorName);

   if (!source) {
      // Create a peer activator
      var ret = this.findConfigActivator(activatorName);

      if (ret) {
         var peerCasaName = ret.owner;
         var sourceName  = ret.name;

         var peerCasa = this.findCasa(peerCasaName);
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
      source = this.findCasa(sourceName);
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

CasaSystem.mainInstance = function() {
   return _mainInstance;
}

module.exports = exports = CasaSystem;

