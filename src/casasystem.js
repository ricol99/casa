var util = require('util');
var S = require('string');
var Thing = require('./thing');

function CasaSystem(_casaName, _config) {
   this.casaName = _casaName;
   this.config = _config;
   this.users = [];
   this.areas = [];
   this.casa = null;
   this.configCasaArea = null;

   Thing.call(this, _config.name, _config.displayName, null, _config.props);

   var that = this;

   var cleverRequire = function(_name) {
      var constructors = {};
      var str = S(_name).between('', ':').s;

      if (!constructors[str]) {
         console.log('loading more code: ./' + str);
         constructors[str] = require('./' + str);
      }
      return constructors[str];
   }

   // Extract Users
   this.config.users.forEach(function(user) { 
      var User = cleverRequire(user.name);
      user.owner = that;
      var userObj = new User(user);
      that.users.push(userObj);
      console.log('New user: ' + user.name);
   });

   // Extract Casa Areas
   this.config.areas.forEach(function(area) { 
      var Area = cleverRequire(area.name);
      area.owner = that;
      var areaObj = new Area(area);
      that.areas.push(areaObj);
      console.log('New area: ' + area.name);
   });

   // Extract Casa
   this.config.areas.forEach(function(area, index) { 
      that.areas[index].casas = [];
      var casaLen = area.casas.length;

      console.log('casas: ' + casaLen);

      for (var j=0; j < casaLen; ++j) {
         console.log('casa found: ' + area.casas[j].name);

         if (that.casaName == area.casas[j].name) {
            // Found myself! Build me!
            var Casa = cleverRequire(that.casaName);
            area.casas[j].casaArea = that.areas[index];
            area.casas[j].parentCasaArea = that.findCasaArea(area.parentArea);
            var casaObj = new Casa(area.casas[j]);
            that.areas[index].casas.push(casaObj);
            that.casa = casaObj;
            that.configCasaArea = area;
            console.log('New casa: ' + casaObj.name);
         }
      }
   });

   
   // Extract Peer Casas for area
   var configArea = this.configCasaArea;
   var casaLen = configArea.casas.length;

   for (var j=0; j < casaLen; ++j) {

      if (!configArea.casas[j].casaArea) {
         // Found a Peer Casa to create!
         var PeerCasa = cleverRequire('peer' + this.casaName);
         configArea.casas[j].casaArea = this.casa.casaArea;
         configArea.casas[j].casa = this.casa;
         // TBD Work this out! Should not be false!
         configArea.casas[j].proActiveConnect = false;
         var casaObj = new PeerCasa(configArea.casas[j]);
         this.casa.casaArea.casas.push(casaObj);
         console.log('New peercasa: ' + casaObj.name);
      }
   }

   // Extract Peer casa of parent area
   var parentCasaArea = this.findCasaArea(configArea.parentArea);

   var len = this.config.areas.length;

   for (var j=0; j < len; ++j) {
      console.log('area: ' + this.config.areas[j].name + '  ==  area: ' + configArea.parentArea);
      if (this.config.areas[j].name == configArea.parentArea) {
         // found parent area
         var PeerCasa = cleverRequire('peer' + this.config.areas[j].casas[0].name);
         this.config.areas[j].casas[0].casaArea = this.areas[j];
         this.config.areas[j].casas[0].casa = this.casa;
         this.config.areas[j].casas[0].proActiveConnect = true;
         var casaObj = new PeerCasa(this.config.areas[j].casas[0]);
         this.areas[j].casas.push(casaObj);
         console.log('New peercasa: ' + casaObj.name);
      } 
   }

   // Extract States
      
}

util.inherits(CasaSystem, Thing);

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

module.exports = exports = CasaSystem;

