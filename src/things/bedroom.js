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
}

util.inherits(Bedroom, Room);


module.exports = exports = Bedroom;
