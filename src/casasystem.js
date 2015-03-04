var util = require('util');
var S = require('string');
var Thing = require('./thing');

var _mainInstance = null;

function CasaSystem(_casaName, _config) {
   this.casaName = _casaName;
   this.config = _config;
   this.uberCasa = false;
   this.users = [];
   this.areas = [];
   this.casa = null;
   this.configCasaArea = null;
   this.configCasa = null;

   this.casaArea = null;
   this.parentCasaArea = null;
   this.childCasaAreas = [];

   this.constructors = {};
   this.allObjects = [];

   Thing.call(this, _config);

   var that = this;
   _mainInstance = this;

   // Extract Users
   this.extractUsers();

   // Extract Casa Areas
   this.extractCasaAreas();

   // Extract My Casa
   this.extractMyCasa();

   // Extract other Casas in my area (Peer Casas)  
   this.extractPeerCasas();

  // Extract Parent casa of parent area
   this.extractParentCasa();

   // Extract Child casas if this is an Uber casa (position 0 casa in an area)
   if (this.uberCasa) {
      this.casa.setUber(true);
      this.extractChildCasas();

      // Allow Casa Areas to build broadcast and forwarding routes
      this.buildCasaAreaRoutes();
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
   this.configCasa.actions.forEach(function(action) { 
      var Action = that.cleverRequire(action.name);
      action.casa = that.casa.name;
      var actionObj = new Action(action);
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

// Extract Users
CasaSystem.prototype.extractUsers = function() {
   var that = this;

   this.config.users.forEach(function(user) { 
      var User = that.cleverRequire(user.name);
      user.owner = that;
      var userObj = new User(user);
      that.users.push(userObj);
      that.allObjects[userObj.name] = userObj;
      console.log('New user: ' + user.name);
   });
}

// Extract Casa Areas
CasaSystem.prototype.extractCasaAreas = function() {
   var that = this;

   // Find and create my area
   this.config.areas.forEach(function(area) { 

      if (area.casas.some(function(casa) { return casa.name == that.casaName; })) {
         that.configCasaArea = area;

         if (area.casas[0].name == that.casaName) {
            that.uberCasa = true;
         }
      }
   });

   // Find parent area
   if (this.configCasaArea.parentArea) {
      this.config.areas.forEach(function(area) { 

         if (that.configCasaArea.parentArea == area.name) {
            // Create parent area
            var Area = that.cleverRequire('parent' + area.name);
            area.owner = that;
            var areaObj = new Area(area);
            areaObj.casas = [];
            that.parentCasaArea = areaObj;
            that.areas.push(areaObj);
            that.allObjects[areaObj.name] = areaObj;
            console.log('New area: ' + area.name);
         }
      });
   }

   // Extract my area
   var Area = this.cleverRequire(this.configCasaArea.name);
   this.configCasaArea.owner = this;
   this.casaArea = new Area(this.configCasaArea);
   this.areas.push(this.casaArea);
   this.allObjects[this.casaArea.name] = this.casaArea;
   console.log('New area: ' + this.configCasaArea.name);

   // Extract child casa areas
   this.extractChildCasaAreas(this.casaArea);
}

CasaSystem.prototype.buildCasaAreaRoutes = function() {
   var casaAreaLen = this.areas.length;

   for (var j=0; j < casaAreaLen; ++j) {
      this.areas[j].createRoutes();
   }
}

CasaSystem.prototype.extractMyCasa = function() {
   var casaLen = this.configCasaArea.casas.length;

   console.log('casas: ' + casaLen);

   for (var j=0; j < casaLen; ++j) {

      if (this.casaName == this.configCasaArea.casas[j].name) {
         // Found myself! Build me!
         var Casa = this.cleverRequire(this.casaName);
         this.configCasaArea.casas[j].casaArea = this.casaArea.name;
         var casaObj = new Casa(this.configCasaArea.casas[j]);
         this.allObjects[casaObj.name] = casaObj;
         this.casa = casaObj;
         this.configCasa = this.configCasaArea.casas[j];
         console.log('New casa: ' + casaObj.name);
         break;
      }
   }
}

CasaSystem.prototype.extractPeerCasas = function() {
   var casaLen = this.configCasaArea.casas.length;
   var proActiveConnect = false;

   for (var j=0; j < casaLen; ++j) {

      if (!this.configCasaArea.casas[j].casaArea) {
         // Found a Peer Casa to create!
         var PeerCasa = this.cleverRequire('peer' + this.casaName);
         this.configCasaArea.casas[j].casaArea = this.casaArea.name;
         this.configCasaArea.casas[j].casa = this.casa.name;
         this.configCasaArea.casas[j].proActiveConnect = proActiveConnect;
         var casaObj = new PeerCasa(this.configCasaArea.casas[j]);
         this.allObjects[casaObj.name] = casaObj;
         console.log('New peercasa: ' + casaObj.name);
      }
      else {
         proActiveConnect = true;
      }
   }
}

CasaSystem.prototype.extractParentCasa = function() {

   if (this.parentCasaArea) {
      var len = this.config.areas.length;

      for (var j=0; j < len; ++j) {
         console.log('area: ' + this.config.areas[j].name + '  ==  area: ' + this.configCasaArea.parentArea);

         if (this.config.areas[j].name == this.configCasaArea.parentArea) {
            // found parent area
            var PeerCasa = this.cleverRequire('parent' + this.config.areas[j].casas[0].name);
            this.config.areas[j].casas[0].casaArea = this.areas[j].name;
            this.config.areas[j].casas[0].casa = this.casa.name;
            var casaObj = new PeerCasa(this.config.areas[j].casas[0]);
            this.parentArea = casaObj.area;
            this.allObjects[casaObj.name] = casaObj;
            console.log('New parentcasa: ' + casaObj.name);
         } 
      }
   }
}

CasaSystem.prototype.extractChildCasas = function() {
   var areaLen = this.config.areas.length;

   for (var area = 0; area < areaLen; ++area) {
      if (this.config.areas[area].parentArea == this.casa.casaArea.name) {
         var casaLen = this.config.areas[area].casas.length;

         for (var j=0; j < casaLen; ++j) {
            var ChildCasa = this.cleverRequire('child' + this.config.areas[area].casas[j].name);
            this.config.areas[area].casas[j].casaArea = this.areas[area].name;
            this.config.areas[area].casas[j].casa = this.casa.name;
            var casaObj = new ChildCasa(this.config.areas[area].casas[j]);
            this.allObjects[casaObj.name] = casaObj;
            console.log('New childcasa: ' + casaObj.name);
         }
      }
   }
}

CasaSystem.prototype.extractChildCasaAreas = function(_parentArea) {
   var that = this;

   this.config.areas.forEach(function(area) { 

      if (area.parentArea && (_parentArea.name == area.parentArea)) {
         // Create child area
         var Area = that.cleverRequire('child' + area.name);
         area.owner = that;
         var areaObj = new Area(area);
         areaObj.casas = [];
         that.areas.push(areaObj);
         that.childCasaAreas[areaObj.name] = areaObj;
         that.allObjects[areaObj.name] = areaObj;
         console.log('New area: ' + area.name);

         // recursively deduce all children of the new area
         that.extractChildCasaAreas(areaObj);
      }
   });
}

CasaSystem.prototype.findNextHopToChildCasaArea = function(_currentCasaArea, _childCasaArea) {

   if (_childCasaArea.parentArea == _currentCasaArea) {
      return _childCasaArea;
   }
   else {
      return this.findNextHopToChildCasaArea(_currentCasaArea, _childCasaArea.parentArea);
   }
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
   var state = this.resolveObject(stateName);

   if (!state) {
      var configState = this.findConfigState(stateName);

      if (configState) {
         state = this.findOrCreateCasaState(this.findCasa(configState.owner), stateName);
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

CasaSystem.prototype.isUberCasa = function() {
  return this.uberCasa;
}

CasaSystem.mainInstance = function() {
   return _mainInstance;
}

module.exports = exports = CasaSystem;

