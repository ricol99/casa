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

   this.bedtimeTimeout = (_config.hasOwnProperty('bedtimeTimeout') ? _config.bedtimeTimeout : 3600 + 1800;

   this.users = [];
   this.userStateConfigs = [];
   var allUsersAwayConfig = { "name": "all-users-away", "type": "andproperty", "initialValue": false, "sources": [] };
   var someUsersInBedConfig = { "name": "some-users-in-bed", "type": "orproperty", "initialValue": false, "sources": [] };
   var allUsersInBedConfig = { "name": "all-users-in-bed", "type": "andproperty", "initialValue": false, "sources": [] };

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.casaSys.findSource(_config.users[u].name));
   }

   for (var i = 0; i < this.users.length; ++i) {
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
         ]
      };

      if (_config.hasOwnProperty('bedrooms') {

         for (var j = 0; j < _config.bedrooms.length; ++j) {
            this.userStateConfigs[i].states[0].sources.push({ "name": _config.bedrooms[j].name, "property": this.users[i].sName+"-in-bed", "value": true, "nextState": "in-bed" });
            this.userStateConfigs[i].states[1].sources.push({ "name": _config.bedrooms[j].name, "property": this.users[i].sName+"-in-bed", "value": true, "nextState": "in-bed" });
            this.userStateConfigs[i].states[2].sources.push({ "name": _config.bedrooms[j].name, "property": this.users[i].sName+"-in-bed", "value": false, "nextState": "present" });
         }
      }

      this.ensurePropertyExists(this.users[i].sName+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);
      this.users[i].ensurePropertyExists(this.sName+"-building-state", 'property', { "initialValue": 'not-present', "source": { "name": this.uName, "property": this.users[i].sName+"-user-state" }}, {});

      allUsersAwayConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value!==\"not-present\"" });
      allUsersInBedConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value!==\"present\"" });
      someUsersInBedConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value===\"in-bed\"" });
   }

   allUsersInBedConfig.sources.push({ "property": "all-users-away", "transform": "!$value" });

   this.ensurePropertyExists("all-users-away", 'andproperty', allUsersAwayConfig, _config);
   this.ensurePropertyExists("all-users-in-bed", 'andproperty', allUsersInBedConfig, _config);
   this.ensurePropertyExists("some-users-in-bed", 'orproperty', someUsersInBedConfig, _config);

   this.ensurePropertyExists("users-state", "stateProperty",
                             { initialValue": "empty",
                               states: [ name: "empty",
                                         source: { property: "all-users-away", value: false, nextState: "occupied" }],

                                       [ name: "occupied-awake",
                                         sources: [{ property: "some-users-in-bed", value: true, nextState: "occupied-going-to-bed" },
                                                   { property: "all-users-away", value: true, nextState: "empty"}]],

                                       [ name: "occupied-going-to-bed",
                                         timeout: { duration: this.bedtimeTimeout, nextState: "occupied-asleep" },
                                         source: { property: "all-users-in-bed", value: true, nextState: "occupied-asleep" }],

                                       [ name: "occupied-asleep",
                                         source: [{ property: "all-users-in-bed", value: false, nextState: "occupied-awake" }], _config);
                                                  { property: "all-users-away", value: true, nextState: "empty" }], _config);


   this.ensurePropertyExists("night-time", 'property', { intialValue: false, source: { property: "users-state", value: "occupied-asleep" }}, _config);
}

util.inherits(Building, Thing);

module.exports = exports = Building;
