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

// alarm-state
// not-armed - alarm not armed
// stay-armed - alarm stay armed (perimeter alarm. ie. no movement sensors) (transitional state until movement status is decided - DO NOT USE)
// stay-armed-house-empty - alarm stay armed, no users present§ and no movement detected
// stay-armed-house-occupied - alarm stay armed with users present
// stay-armed-animals-present - alarm stay armed and movement detected, but no users present
// night-armed - alarm stay armed (perimeter alarm. ie. no movement sensors) - users present assumed
// away-armed - alarm fully armed (movement sensors active)
// zone-alarm - zone has been triggered
// confirmed-alarm - mulitple zones have been triggered
// fire-alarm - fire detector has been triggered


function Building(_config) {

   Thing.call(this, _config);
   this.thingType = "building";

   this.bedtimeTimeout = (_config.hasOwnProperty('bedtimeTimeout')) ? _config.bedtimeTimeout : 3600 + 1800;

   this.users = [];
   this.userStateConfigs = [];
   var allUsersAwayConfig = { "name": "all-users-away", "type": "andproperty", "initialValue": true, "sources": [] };
   var someUsersInBedConfig = { "name": "some-users-in-bed", "type": "orproperty", "initialValue": false, "sources": [] };
   var allUsersInBedConfig = { "name": "all-users-in-bed", "type": "andproperty", "initialValue": false, "sources": [] };

   this.ensurePropertyExists("evening-possible", 'scheduleproperty',
                             { "initialValue": false, "events": [ { "rule": "sunset:-7200", "value": true }],
                               "source": { "property": "night-time", "value": true, "transform": "!$value" }}, _config);

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findSource(_config.users[u].uName));
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
               "sources": [{ "property": this.users[i].sName+"-present", "value": true, "nextState": "present" }],
               "event": { "name": "user-left", "value": this.users[i].sName }
            },
            {
               "name": "present",
               "sources": [{ "property": this.users[i].sName+"-present", "value": false, "nextState": "not-present" }],
               "event": { "name": "user-arrived", "value": this.users[i].sName }
            },
            {
               "name": "in-bed",
               "sources": [],
               "event": { "name": "user-went-to-bed", "value": this.users[i].sName }
            }
         ]
      };

      if (_config.hasOwnProperty('bedrooms')) {

         for (var j = 0; j < _config.bedrooms.length; ++j) {
            this.userStateConfigs[i].states[0].sources.push({ "uName": _config.bedrooms[j].uName, "property": this.users[i].sName+"-in-bed", "value": true, "nextState": "in-bed" });
            this.userStateConfigs[i].states[1].sources.push({ "uName": _config.bedrooms[j].uName, "property": this.users[i].sName+"-in-bed", "value": true, "nextState": "in-bed" });
            this.userStateConfigs[i].states[2].sources.push({ "uName": _config.bedrooms[j].uName, "property": this.users[i].sName+"-in-bed", "value": false, "nextState": "present" });
         }
      }

      this.ensurePropertyExists(this.users[i].sName+"-present", 'property', { name: this.users[i].sName+"-present", initialValue: false }, _config);
      this.ensurePropertyExists(this.users[i].sName+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);
      this.users[i].ensurePropertyExists(this.sName+"-building-state", 'property', { "initialValue": 'not-present', "source": { "uName": this.uName, "property": this.users[i].sName+"-user-state" }}, {});

      allUsersAwayConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value===\"not-present\"" });
      allUsersInBedConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value!==\"present\"" });
      someUsersInBedConfig.sources.push({ "property": this.users[i].sName+"-user-state", "transform": "$value===\"in-bed\"" });
   }

   allUsersInBedConfig.sources.push({ "property": "some-users-in-bed" });

   // user properties
   this.ensurePropertyExists("all-users-away", 'andproperty', allUsersAwayConfig, _config);
   this.ensurePropertyExists("all-users-in-bed", 'andproperty', allUsersInBedConfig, _config);
   this.ensurePropertyExists("some-users-in-bed", 'orproperty', someUsersInBedConfig, _config);

   this.ensurePropertyExists("users-state", "stateproperty",
                             { initialValue: "empty",
                               states: [ { name: "empty", source: { property: "all-users-away", value: false, nextState: "occupied-awake" }},
                                         { name: "occupied-awake", sources: [{ property: "some-users-in-bed", value: true, nextState: "occupied-going-to-bed" },
                                                                             { property: "all-users-away", value: true, nextState: "empty" }]},
                                         { name: "occupied-going-to-bed", sources: [{ property: "all-users-in-bed", value: true, nextState: "occupied-asleep" },
                                                                                    { property: "all-users-away", value: true, nextState: "empty" }]},
                                         { name: "occupied-asleep", sources: [{ property: "all-users-in-bed", value: false, nextState: "occupied-may-be-waking-up" },
                                                                              { event: "user-arrived", nextState: "occupied-going-to-bed" },
                                                                              { property: "all-users-away", value: true, nextState: "empty" }] },
                                         { name: "occupied-may-be-waking-up", timeout: { duration: 5, nextState: "occupied-waking-up" },
                                           sources: [ { event: "user-arrived", nextState: "occupied-going-to-bed" }] },
                                         { name: "occupied-waking-up", timeout: { duration: this.bedtimeTimeout, nextState: "occupied-awake" },
                                           sources: [{ property: "some-users-in-bed", value: false, nextState: "occupied-awake" },
                                                     { property: "all-users-away", value: true, nextState: "empty" }] }]}, _config);

   // Movement property
   var movementConfig = { "name": "movement", "type": "orproperty", "initialValue": false, "sources": [] };

   if (_config.hasOwnProperty('bedrooms')) {
         
      for (var j = 0; j < _config.bedrooms.length; ++j) {
         movementConfig.sources.push({ "uName": _config.bedrooms[j].uName, "property": "movement" });
      }
   }

   if (_config.hasOwnProperty('rooms')) {
         
      for (var r = 0; r < _config.rooms.length; ++r) {
         movementConfig.sources.push({ "uName": _config.rooms[r].uName, "property": "movement" });
      }
   }

   this.ensurePropertyExists("movement", "orproperty", movementConfig, _config);

   // night-time property
   this.ensurePropertyExists("night-time", 'scheduleproperty', { intialValue: false, events: [ { rule: "05 03 * * *", value: true } ],
                                                                 source: { property: "users-state", transform: "$value===\"occupied-asleep\"" }}, _config);

   // Alarm state property definition
   this.allUsersLeftTimeout = _config.hasOwnProperty("allUsersLeftTimeout") ? _config.allUsersLeftTimeout : 240;

   this.alarmStateConfig = {
      "name": "alarm-state",
      "type": "stateproperty",
      "initialValue": "not-armed",
      "ignoreControl": true,
      "states": [
         {
            "name": "not-armed",
            "sources": [{ "property": "stay-armed", "value": true, "nextState": "stay-armed" },
                        { "property": "night-armed", "value": true, "nextState": "night-armed" },
                        { "property": "away-armed", "value": true, "nextState": "away-armed" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         },
         {
            "name": "stay-armed",
            "sources": [{ "property": "stay-armed", "value": false, "nextState": "not-armed" },
                        { "property": "all-users-away", "value": true, "nextState": "stay-armed-house-empty" },
                        { "property": "zone-alarm", "value": true, "nextState": "zone-alarm" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }],
            "timeout": { "duration": this.allUsersLeftTimeout, "nextState": "stay-armed-house-occupied" }
         },
         {
            "name": "stay-armed-house-empty",
            "sources": [{ "property": "stay-armed", "value": false, "nextState": "not-armed" },
                        { "property": "movement", "value": true, "nextState": "stay-armed-animals-present" },
                        { "property": "zone-alarm", "value": true, "nextState": "zone-alarm" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         },
         {
            "name": "stay-armed-house-occupied",
            "sources": [{ "property": "stay-armed", "value": false, "nextState": "not-armed" },
                        { "property": "all-users-away", "value": true, "nextState": "stay-armed-house-empty" },
                        { "property": "zone-alarm", "value": true, "nextState": "zone-alarm" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         },
         {
            "name": "stay-armed-animals-present",
            "sources": [{ "property": "stay-armed", "value": false, "nextState": "not-armed" },
                        { "property": "zone-alarm", "value": true, "nextState": "zone-alarm" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         },
         {
            "name": "night-armed",
            "sources": [{ "property": "night-armed", "value": false, "nextState": "not-armed" },
                        { "property": "zone-alarm", "value": true, "nextState": "zone-alarm" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         },
         {
            "name": "away-armed",
            "sources": [{ "property": "away-armed", "value": false, "nextState": "not-armed" },
                        { "property": "zone-alarm", "value": true, "nextState": "zone-alarm" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         },
         {
            "name": "zone-alarm",
            "sources": [{ "property": "zone-alarm", "value": false, "nextState": "not-armed" },
                        { "property": "confirmed-alarm", "value": true, "nextState": "confirmed-alarm" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }],
         },
         {
            "name": "fire-alarm",
            "sources": [{ "property": "fire-alarm", "value": false, "nextState": "not-armed" }]
         },
         {
            "name": "confirmed-alarm",
            "sources": [{ "property": "confirmed-armed", "value": false, "nextState": "not-armed" },
                        { "property": "fire-alarm", "value": true, "nextState": "fire-alarm" }]
         }
      ]
   };

   this.ensurePropertyExists("alarm-state", 'stateproperty', this.alarmStateConfig, _config);

   this.ensurePropertyExists('line-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('ac-power-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('battery-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('medical-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('panic-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('duress-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('attack-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('carbon-monoxide-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('armed-normal', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('part-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('stay-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('night-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('away-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('zone-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('in-exit-entry', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('system-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('engineer-mode', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('alarm-error', 'property', { initialValue: '' }, _config);
}

util.inherits(Building, Thing);

module.exports = exports = Building;
