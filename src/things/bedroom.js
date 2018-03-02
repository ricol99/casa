var util = require('util');
var MovementSensitiveRoom = require('./movementsensitiveroom');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights
// room-switch-event - let the users indicate they are getting ready for bed or going to sleep
// <username>-switch-event - let each user control their own readiness for bed

// Resulting user-state (s)
// no-users-present - no movement detected
// users-present - movement detected
// users-detected-in-low-light - movement detected in low-light
// no-users-in-low-light - movement detected in low-light

function Bedroom(_config) {

   MovementSensitiveRoom.call(this, _config);

   this.users = [];
   this.userStateConfigs = [];

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
               "sources": [ { "event": this.users[i].sName+"-switch-event", "nextState": "reading-in-bed" } ],
            },
            {
               "name": "reading-in-bed",
               "priority": 101,
               "sources": [ { "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" } ],
            },
            {
               "name": "reading-in-bed-others-asleep",
               "priority": 101,
               "sources": [ { "property": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" } ],
            },
            {
               "name": "asleep-in-bed",
               "priority": 101,
               "sources": [ { "event": this.users[i].sName+"-switch-event", "nextState": "reading-in-bed" } ],
            }
         ]
      };

      for (var j = 0; j < this.users.length; ++j) {

         if (i !== j) {
            this.userStateConfigs[i].states[1].sources.push({ "property": this.users[j].sName, "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[2].sources.push({ "property": this.users[j].sName, "value": "reading-in-bed", "nextState": "reading-in-bed" });
            this.userStateConfigs[i].states[2].sources.push({ "property": this.users[j].sName, "value": "reading-in-bed-others-asleep", "nextState": "reading-in-bed" });
         }
      }

      this.ensurePropertyExists(this.users[i].sName+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);
     this.users[i].ensurePropertyExists("bedroom-state", 'property', { "initialValue": 'not-present', "source": { "name": this.uName, "property": this.users[i].sName+"-user-state" }}, {});
   }
}

util.inherits(Bedroom, MovementSensitiveRoom);


module.exports = exports = Bedroom;
