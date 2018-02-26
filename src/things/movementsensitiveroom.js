var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights

// Resulting user-state (s)
// no-users-present - no movement detected
// users-present - movement detected
// users-detected-in-low-light - movement detected in low-light

function MovementSensitiveRoom(_config) {

   Room.call(this, _config);

   this.movementTimeout = (_config.hasOwnProperty('movementTimeout')) ? _config.movementTimeout : 60;

   this.userStateConfig = {
      "name": "user-state",
      "type": "stateproperty",
      "initialValue": "no-users-present",
      "states": [
         {  
            "name": "no-users-present",
            "sources": [ {  "property": "movement-pir", "value": true, "nextState": "users-present" } ],
         },
         {  
            "name": "users-present",
            "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present" },
            "sources": [ { "property": "low-light", "value": true, "nextState": "users-present-in-low-light" }, { "property": "movement-pir", "value": true, "nextState": "users-present" } ],
         },
         {
            "name": "users-present-in-low-light",
            "priority": 2,
            "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present" },
            "sources": [ { "property": "movement-pir", "value": true, "nextState": "users-present-in-low-light" } ],
         }
      ]
   };

   this.ensurePropertyExists('user-state', 'stateproperty', this.userStateConfig, _config);
}

util.inherits(MovementSensitiveRoom, Room);


module.exports = exports = MovementSensitiveRoom;
