var util = require('util');
var S = require('string');

var _mainInstance = null;

function CasaSystem(_config, _connectToPeers) {
   this.casaName = _config.name;
   this.config = _config;
   this.name = _config.name;
   this.uberCasa = false;
   this.users = [];
   this.things = [];
   this.casaAreas = [];
   this.casa = null;
   this.peerCasas = [];
   this.parentCasa = null;
   this.remoteCasas = [];
   this.transforms = [];

   this.casaArea = null;
   this.parentCasaArea = null;
   this.peerCasaArea = null;
   this.childCasaAreas = [];

   this.constructors = {};
   this.allObjects = [];

   this.areaId = 1;

   var that = this;
   _mainInstance = this;

   // Extract My Casa
   this.extractCasa();

   // Extract Users
   this.extractUsers();

   // Extract Things
   this.extractThings();

   // Extract Parent casa of parent area
   this.extractParentCasa();

   // Extract all transforms hosted by this casa
   this.extractCasaTransforms();

   // Extract all activators hosted by this casa
   this.extractCasaActivators();

   // Extract all actions hosted by this casa
   this.extractCasaActions();

   // Create area for peer casas to live in
   this.createPeerCasaArea();

   // Make sure all listeners are refreshed now that all sources are available
   this.casa.refreshSourceListeners();

   // Cold start all defined things now that the activators and actions have been created
   this.coldStartThings();

   // start conecting to parent, if it exists
   if (this.parentCasa) {
      setTimeout(function() {
         that.parentCasa.start();
      }, 10000);
   }

   if (_connectToPeers) {
      var PeerCasaService = require('./peercasaservice');
      this.peerCasaService = new PeerCasaService({ gang: _config.gang });
   }
}

CasaSystem.prototype.cleverRequire = function(_name) {
   var str = S(_name).between('', ':').s;

   if (!this.constructors[str]) {
      console.log('loading more code: ./' + str);
      this.constructors[str] = require('./' + str);
   }
   return this.constructors[str];
}

CasaSystem.prototype.deletePeerCasa = function(_peerCasa) {

  if (remoteCasas[_peerCasa.name]) {
     delete remoteCasas[_peerCasa.name];
     delete allObjects[_peerCasa.name];

     if (parentCasa == _peerCasa) {
     }

     if (childCasas[_peerCasa.name]) {
        delete childCasas[_peerCasa.name];
     }

     if (_peerCasa.persistent) {
     }
  }
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

// Extract Things
CasaSystem.prototype.extractThings = function() {
   var that = this;

   if (this.config.things) {

      this.config.things.forEach(function(_thing) { 
         var Thing = that.cleverRequire(_thing.name);
         var thingObj = new Thing(_thing);
         that.things[thingObj.name] = thingObj;
         that.allObjects[thingObj.name] = thingObj;
         console.log('New thing: ' + _thing.name);
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
      this.parentCasa = new ParentCasa(this.config.parentCasa);
      this.remoteCasas[this.parentCasa.name] = this.parentCasa;
      this.allObjects[this.parentCasa.name] = this.parentCasa;
      console.log('New parentcasa: ' + this.parentCasa.name);

      var ParentCasaArea = require('./parentcasaarea');
      this.parentCasaArea = new ParentCasaArea ({ name: 'parentcasaarea:my-parent' });
      this.casaAreas[this.parentCasaArea.name] = this.parentCasaArea;
      this.allObjects[this.parentCasaArea.name] = this.parentCasaArea;
      console.log('New parentcasaarea: ' + this.parentCasaArea.name);

      this.parentCasa.setCasaArea(this.parentCasaArea);
   }
}

CasaSystem.prototype.extractCasaTransforms = function() {
   var that = this;

   this.config.transforms.forEach(function(transform) { 
      var Transform = that.cleverRequire(transform.name);
      transform.casa = that.casa.name;
      var transformObj = new Transform(transform);
      that.transforms[transformObj.name] = transformObj;
      that.allObjects[transformObj.name] = transformObj;
      console.log('New transform: ' + transform.name);
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

CasaSystem.prototype.coldStartThings = function() {

   for(var prop in this.things) {

      if (this.things.hasOwnProperty(prop)){
         console.log(this.name + ': Cold starting thing ' + this.things[prop].name);
         this.things[prop].coldStart();
      }
   }
}

CasaSystem.prototype.createPeerCasaArea = function() {
   var PeerCasaArea = require('./peercasaarea');
   this.peerCasaArea= new PeerCasaArea({ name: 'peercasaarea:my-peers' });
   this.casaAreas[this.peerCasaArea.name] = this.peerCasaArea;
   this.allObjects[this.peerCasaArea.name] = this.peerCasaArea;
}

CasaSystem.prototype.createChildCasaArea = function(_casas) {
   var ChildCasaArea = require('./childcasaarea');
   var childCasaArea = new ChildCasaArea({ name: 'childcasaarea:' + this.casa.name + this.areaId});

   this.areaId = (this.areaId + 1) % 100000;

   this.casaAreas[childCasaArea.name] = childCasaArea;
   this.childCasaAreas[childCasaArea.name] = childCasaArea;
   this.allObjects[childCasaArea.name] = childCasaArea;

   var len = _casas.length;

   for (var i = 0 ; i < len; ++i) {
      _casas[i].setArea(childCasaArea);
   }
   return childCasaArea;
}

CasaSystem.prototype.findCasaArea = function(_areaName) {
   return this.casaAreas[_areaName];
}

CasaSystem.prototype.deleteCasaArea = function(_area) {
   delete this.casaAreas[_area.name];
   delete this.allObjects[_area.name];
   delete this.childCasaAreas[_area.name];

   if (_area == this.parentCasaArea) {
      this.parentCasaArea = null;
   }
   _area.removeAllCasas();

   delete _area;
}

CasaSystem.prototype.resolveCasaAreasAndPeers = function(_casaName, _peers) {
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

CasaSystem.prototype.createChildCasa = function(_config, _peers) {
   console.log('Creating a child casa for casa ' + _config.name);

   var area = null;

   // Resolve area
   area = this.resolveCasaAreasAndPeers(_config.name, _peers);

   var ChildCasa = require('./childcasa');
   var childCasa = new ChildCasa(_config);

   if (area) {
      childCasa.setCasaArea(area);
   }

   this.remoteCasas[childCasa.name] = childCasa;
   this.allObjects[childCasa.name] = childCasa;

   this.setUberCasa(true);
   return childCasa;
}

CasaSystem.prototype.createPeerCasa = function(_config) {
   console.log('Creating a peer casa for casa ' + _config.name);
   var PeerCasa = require('./peercasa');
   var peerCasa = new PeerCasa(_config);
   peerCasa.setCasaArea(this.peerCasaArea);

   this.remoteCasas[peerCasa.name] = peerCasa;
   this.allObjects[peerCasa.name] = peerCasa;
   return peerCasa;
}

CasaSystem.prototype.findUser = function (_userName) {
   return this.users[_userName];
}

CasaSystem.prototype.findRemoteCasa = function (_casaName) {
   return this.remoteCasas[_casaName];
}

CasaSystem.prototype.findCasaActivator = function (_casa, _activatorName) {
   return _casa.activators[_activatorName];
}

CasaSystem.prototype.findActivator = function (_activatorName) {
    return this.allObjects[_activatorName];
}

CasaSystem.prototype.findSource = function (_sourceName) {
   return this.allObjects[_sourceName];
}

CasaSystem.prototype.resolveObject = function (objName) {
    return this.allObjects[objName];
}

CasaSystem.prototype.setUberCasa = function(_uberCasa) {
   if (_uberCasa && !this.uberCasa) {
      // Becoming an uber casa
      this.uberCasa = _uberCasa;
   }
   else if (!_uberCasa && this.uberCasa) {
      // Losing uber casa status
      this.uberCasa = _uberCasa;
   }
}

CasaSystem.prototype.isUberCasa = function() {
  return this.uberCasa;
}

CasaSystem.mainInstance = function() {
   return _mainInstance;
}

module.exports = exports = CasaSystem;

