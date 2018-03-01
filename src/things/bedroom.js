var util = require('util');
var MovementSensitiveRoom = require('./room');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights
// room-switch-event - let the users indicate they are getting ready for bed or going to sleep
// <username>-switch-event - let each user control their own readyness for bed

// Resulting user-state (s)
// no-users-present - no movement detected
// users-present - movement detected
// users-detected-in-low-light - movement detected in low-light
// no-users-in-low-light - movement detected in low-light

function Bedroom(_config) {

   MovementSensitiveRoom.call(this, _config);

   this.users = _config.users;
   this.userStateConfigs = [];

   for (var i = 0; i < this.users.length; ++i) {
      this.userStateConfigs.push({});
      this.userStateConfigs[i] = {
         "name": this.users[i].name+"-user-state",
         "type": "stateproperty",
         "initialValue": this.users[i].name+"-not-present",
         "states": [
            {
               "name": "not-present",
               "sources": [ { "event": this.users[i].name+"-switch-event", "nextState": "reading" } ],
            },
            {
               "name": "reading",
               "priority": 101,
               "sources": [ { "event": this.users[i].name+"-switch-event", "nextState": "asleep" } ],
            },
            {
               "name": "reading-while-others-asleep",
               "priority": 101,
               "sources": [ { "property": this.users[i].name+"-switch-event", "nextState": "asleep" } ],
            },
            {
               "name": "asleep",
               "priority": 101,
               "sources": [ { "event": this.users[i].name+"-switch-event", "nextState": "reading" } ],
            }
         ]
      };

      for (var j = 0; j < this.users.length; ++j) {

         if (i !== j) {
            this.userStateConfigs[i].states[1].sources.push({ "property": this.users[j].name, "value": "asleep", "nextState": "reading-while-others-asleep" });
         }
      }
   }

   this.usersStateConfig = {
      "name": "users-state",
      "type": "stateproperty",
      "initialValue": "no-users-present",
      "states": [
         {  
            "name": "no-users-present",
            "sources": [ {  "property": "movement-pir", "value": true, "nextState": "users-present" }, { "property": "low-light", "value": true, "nextState": "no-users-in-low-light" } ],
         },
         {  
            "name": "users-present",
            "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present" },
            "sources": [ { "property": "low-light", "value": true, "nextState": "users-present-in-low-light" }, { "property": "movement-pir", "value": true, "nextState": "users-present" } ],
         },
         {  
            "name": "no-users-in-low-light",
            "priority": 2,
            "sources": [ {  "property": "movement-pir", "value": true, "nextState": "users-present-in-low-light" }, { "property": "low-light", "value": false, "nextState": "no-users-present" } ],
         },
         {
            "name": "users-present-in-low-light",
            "priority": 3,
            "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present" },
            "sources": [ { "property": "movement-pir", "value": true, "nextState": "users-present-in-low-light" } ],
         }
      ]
   };

   this.ensurePropertyExists('user-state', 'stateproperty', this.userStateConfig, _config);

   if (this.securityLightsSchedule) {

      this.securityLightsConfig = {
         "name": "security-lights-state",
         "type": "stateproperty",
         "initialValue": "off",
         "states": [
            {
               "name": "off"
            },
            {
               "name": "on",
               "priority": 1
            }
         ]
      };

      for (var i = 0; i < this.securityLightsSchedule.length; ++i) {

         switch (this.securityLightsSchedule[i].name) {
            case "off":
               this.securityLightsConfig.states[0].schedule = this.securityLightsSchedule[i];
               break;
            case "on":
               this.securityLightsConfig.states[1].schedule = this.securityLightsSchedule[i];
               break;
         }
      }

      this.ensurePropertyExists('security-lights-state', 'stateproperty', this.securityLightsConfig, _config);
   }

   if (this.overrideSchedule) {

      this.overrideConfig = {
         "name": "override-state",
         "type": "stateproperty",
         "initialValue": "off",
         "states": [
            {
               "name": "off",
               "priority": 0
            },
            {
               "name": "on",
               "priority": 4
            }
         ]
      };

      for (var i = 0; i < this.overrideSchedule.length; ++i) {

         switch (this.overrideSchedule[i].name) {
            case "off":
               this.securityLightsConfig.states[0].schedule = this.overrideSchedule[i];
               break;
            case "on":
               this.securityLightsConfig.states[1].schedule = this.overrideSchedule[i];
               break;
         }
      }

      this.ensurePropertyExists('override-state', 'stateproperty', this.overrideConfig, _config);
   }
}

util.inherits(Bedroom, Room);


module.exports = exports = Bedroom;
