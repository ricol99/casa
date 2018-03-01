var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights

// Resulting room-state (s)
// no-users-present - no movement detected
// users-present - movement detected
// users-detected-in-low-light - movement detected in low-light
// no-users-in-low-light - movement detected in low-light

function MovementSensitiveRoom(_config) {

   Room.call(this, _config);

   this.movementTimeout = (_config.hasOwnProperty('movementTimeout')) ? _config.movementTimeout : 60;
   this.securityLightsSchedule = (_config.hasOwnProperty('securityLightsSchedule')) ? _config.securityLightsSchedule : undefined;

   this.roomStateConfig = (_config.hasOwnProperty('roomStateConfig')) ? _config.roomStateConfig : {};
   this.roomStateConfig.name = "room-state";
   this.roomStateConfig.type = "stateproperty";

   if (!this.roomStateConfig.hasOwnProperty("initialValue")) {
      this.roomStateConfig.initialValue = "no-users-present";
   }

   if (!this.roomStateConfig.hasOwnProperty("states")) {
      this.roomStateConfig.states = [];
   }

   if (!nameExists(this.roomStateConfig.states, "no-users-present")) {
      this.roomStateConfig.states.push({ "name": "no-users-present",
                                         "sources": [{ "property": "movement-pir", "value": true, "nextState": "users-present" },
                                                     { "property": "low-light", "value": true, "nextState": "no-users-in-low-light" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "users-present")) {
      this.roomStateConfig.states.push({ "name": "users-present",
                                         "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present" },
                                         "sources": [{ "property": "low-light", "value": true, "nextState": "users-present-in-low-light" },
                                                     { "property": "movement-pir", "value": true, "nextState": "users-present" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "no-users-in-low-light")) {
      this.roomStateConfig.states.push({ "name": "no-users-in-low-light", "priority": 2,
                                         "sources": [{ "property": "movement-pir", "value": true, "nextState": "users-present-in-low-light" },
                                                     { "property": "low-light", "value": false, "nextState": "no-users-present" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "users-present-in-low-light")) {
      this.roomStateConfig.states.push({ "name": "users-present-in-low-light", "priority": 3,
                                         "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present" },
                                         "sources": [ { "property": "movement-pir", "value": true, "nextState": "users-present-in-low-light" }]});
   }

   this.ensurePropertyExists('room-state', 'stateproperty', this.roomStateConfig, _config);

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
}

util.inherits(MovementSensitiveRoom, Room);

function nameExists(_objArray, _name) {

   for (var i = 0; i < _objArray.length; ++i) {

      if (_objArray[i].name === _name) {
         return true;
      }
   }

   return false;
}

module.exports = exports = MovementSensitiveRoom;
