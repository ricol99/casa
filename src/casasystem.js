var util = require('util');
var S = require('string');

var _mainInstance = null;

function CasaSystem(_systemConfig, _config, _connectToPeers, _version) {
   this.casaName = _config.name;
   this.config = _config;
   this.systemConfig = _systemConfig;
   this.name = _systemConfig.name;
   this.version = _version;

   this.uberCasa = false;
   this.users = [];
   this.things = [];
   this.casaAreas = [];
   this.casa = null;
   this.peerCasas = [];
   this.parentCasa = null;
   this.remoteCasas = [];

   this.casaArea = null;
   this.parentCasaArea = null;
   this.peerCasaArea = null;
   this.childCasaAreas = [];

   this.constructors = {};
   this.allObjects = [];

   this.areaId = 1;

   var that = this;
   _mainInstance = this;

   // Merge Configs
   this.mergeConfigs();

   // Extract Casa
   this.extractCasa();

   // Extract Users
   this.extractUsers();

   // Extract Things
   this.extractThings();

   // Extract Parent casa of parent area
   this.extractParentCasa();

   // Create area for peer casas to live in
   this.createPeerCasaArea();

   // Make sure all listeners are refreshed now that all sources are available
   this.casa.refreshSourceListeners();

   // Cold start all defined things now that everything has been created
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

CasaSystem.prototype.mergeConfigs = function() {
   this.config.users = this.systemConfig.users;

   for (var i = 0; i < this.systemConfig.things.length; ++i) {
      this.config.things.push(this.systemConfig.things[i]);
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

