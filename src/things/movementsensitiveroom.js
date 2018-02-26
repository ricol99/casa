var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights

// Resulting user-state (s)
// no-users-present - no movement detected
// users-present - movement detected
// users-detected-in-low-light - movement detected in low-light
// no-users-in-low-light - movement detected in low-light

function MovementSensitiveRoom(_config) {

   Room.call(this, _config);

   this.movementTimeout = (_config.hasOwnProperty('movementTimeout')) ? _config.movementTimeout : 60;
   this.securityLightsSchedule = (_config.hasOwnProperty('securityLightsSchedule')) ? _config.securityLightsSchedule : undefined;
   this.overrideSchedule = (_config.hasOwnProperty('overrideSchedule')) ? _config.overrideSchedule : undefined;

   this.userStateConfig = {
      "name": "user-state",
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
               "name": "off"
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

util.inherits(MovementSensitiveRoom, Room);


module.exports = exports = MovementSensitiveRoom;
