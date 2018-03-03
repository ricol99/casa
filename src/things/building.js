var util = require('util');
var Thing = require('../thing');

// Please provide inputs
// users - users that will use the building
// bedrooms - bedrooms the users will sleep in

// Please define properties for automated functionality
// low-light - true when light levels are low enough to switch on lights
// <user>-present - property representing a user being present in the building

// Resulting properties
// <user>-user-state (s)
//   - not-present - user not in the building
//   - present - user in the building
//   - in-bed - user in the building and in-bed
// night-time - true when all present users are in bed

function Building(_config) {

   Thing.call(this, _config);

   this.users = [];
   this.userStateConfigs = [];
   var nightTimeConfig = { "name": "users-in-bed", "type": "andproperty", "initialValue": false, "sources": [] };

   for (var i = 0; i < this.users.length; ++i) {
      this.users.push(this.casaSys.findSource(_config.users[i].name));

      this.userStateConfigs.push({});
      this.userStateConfigs[i] = {
         "name": this.users[i].sName+"-user-state",
         "type": "stateproperty",
         "initialValue": "not-present",
         "states": [
            {
               "name": "not-present",
               "sources": [{ "property": this.users[i].sName+"-present", "value": true, "nextState": "present" }]
            },
            {
               "name": "present",
               "priority": 101,
               "sources": [{ "property": this.users[i].sName+"-present", "value": false, "nextState": "not-present" }]
            },
            {
               "name": "in-bed",
               "priority": 101,
               "sources": [{ "property": this.users[i].sName+"-present", "value": false, "nextState": "not-present" }]
            }
         ];

         if (_config.bedrooms) {

            for (var j = 0; j < _config.bedrooms.length; ++j) {
               this.userStateConfigs[i].states[0].sources.push({ "name": _config.bedrooms[j].name, "property": this.users[i].sName+"-in-bed", "value": true, "nextState": "in-bed");
               this.userStateConfigs[i].states[1].sources.push({ "name": _config.bedrooms[j].name, "property": this.users[i].sName+"-in-bed", "value": true, "nextState": "in-bed");
               this.userStateConfigs[i].states[2].sources.push({ "name": _config.bedrooms[j].name, "property": this.users[i].sName+"-in-bed", "value": false, "nextState": "present");
            }
         }

      };

      this.ensurePropertyExists(this.users[i].sName+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);
      this.users[i].ensurePropertyExists(this.sName+"-building-state", 'property', { "initialValue": 'not-present', "source": { "name": this.uName, "property": this.users[i].sName+"-user-state" }}, {});

      nightTimeConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value!==\"present\"" });
   }

   this.ensurePropertyExists("night-time", 'property', nightTimeConfig, _config);
}

util.inherits(Building, Thing);

function findBedroomForUser(_objArray, _name) {

   for (var i = 0; i < _objArray.length; ++i) {

      if (_objArray[i].name === _name) {
         return i;
      }
   }

   return -1;
}

module.exports = exports = Building;
