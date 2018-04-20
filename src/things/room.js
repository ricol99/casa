var util = require('util');
var Thing = require('../thing');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights
// night-time - true when head to bed and no longer want any background lights
// room-switch-event - room entrance switch

// Resulting room-state (s)
// no-users-present - no movement detected
// users-present - movement detected
// no-users-present-evening - no movement detected in low-light before bed-time (background lights)
// users-present-evening - movement detected in low-light before bed-time
// no-users-present-night - no movement detected in low-light after bed-time (night light)
// users-present-night - movement detected in low-light after bed-time (night light when users moving)
// no-users-present-morning - no movement detected in low-light after wake up call
// users-present-morning - movement detected in low-light after wake up call

function Room(_config) {
   Thing.call(this, _config);
   this.thingType = "room";
   this.overrideTimeout = (_config.hasOwnProperty("overrideTimeout")) ? _config.overrideTimeout : 900;

   this.movementTimeout = (_config.hasOwnProperty('movementTimeout')) ? _config.movementTimeout : 600;

   this.roomStateConfig = (_config.hasOwnProperty('roomStateConfig')) ? _config.roomStateConfig : {};
   this.roomStateConfig.name = "room-state";
   this.roomStateConfig.type = "stateproperty";

   if (!this.roomStateConfig.hasOwnProperty("initialValue")) {
      this.roomStateConfig.initialValue = "no-users-present-day";
   }

   if (!this.roomStateConfig.hasOwnProperty("states")) {
      this.roomStateConfig.states = [];
   }

   if (!nameExists(this.roomStateConfig.states, "no-users-present-day")) {
      this.roomStateConfig.states.push({ "name": "no-users-present-day",
                                         "sources": [{ "property": "movement-pir", "value": true, "nextState": "users-present-day" },
                                                     { "property": "low-light", "value": true, "nextState": "no-users-present-evening" },
                                                     { "property": "night-time", "value": true, "nextState": "no-users-present-night" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "users-present-day")) {
      this.roomStateConfig.states.push({ "name": "users-present-day",
                                         "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present-day" },
                                         "sources": [{ "property": "low-light", "value": true, "nextState": "users-present-evening" },
                                                     { "property": "night-time", "value": true, "nextState": "users-present-night" },
                                                     { "property": "movement-pir", "value": true, "nextState": "users-present-day" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "no-users-present-evening")) {
      this.roomStateConfig.states.push({ "name": "no-users-present-evening",
                                         "sources": [{ "property": "movement-pir", "value": true, "nextState": "users-present-evening" },
                                                     { "property": "night-time", "value": true, "nextState": "no-users-present-night" },
                                                     { "property": "low-light", "value": false, "nextState": "no-users-present-day" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "users-present-evening")) {
      this.roomStateConfig.states.push({ "name": "users-present-evening",
                                         "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present-evening" },
                                         "sources": [ { "property": "low-light", "value": false, "nextState": "users-present-day" },
                                                      { "property": "night-time", "value": true, "nextState": "users-present-night" },
                                                      { "property": "movement-pir", "value": true, "nextState": "users-present-evening" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "no-users-present-night")) {
      this.roomStateConfig.states.push({ "name": "no-users-present-night",
                                         "sources": [{ "property": "movement-pir", "value": true, "nextState": "users-present-night" },
                                                     { "property": "night-time", "value": false, "nextState": "no-users-present-morning" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "users-present-night")) {
      this.roomStateConfig.states.push({ "name": "users-present-night",
                                         "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present-night" },
                                         "sources": [ { "property": "night-time", "value": false, "nextState": "users-present-morning" },
                                                      { "property": "movement-pir", "value": true, "nextState": "users-present-night" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "no-users-present-morning")) {
      this.roomStateConfig.states.push({ "name": "no-users-present-morning",
                                         "sources": [{ "property": "movement-pir", "value": true, "nextState": "users-present-morning" },
                                                     { "property": "low-light", "value": false, "nextState": "no-users-present-day" }]});
   }

   if (!nameExists(this.roomStateConfig.states, "users-present-morning")) {
      this.roomStateConfig.states.push({ "name": "users-present-morning",
                                         "timeout": { "duration": this.movementTimeout, "nextState": "no-users-present-night" },
                                         "sources": [ { "property": "movement-pir", "value": true, "nextState": "users-present-morning" },
                                                      { "property": "low-light", "value": false, "nextState": "no-users-present-day" }]});
   }

   this.ensurePropertyExists('room-state', 'stateproperty', this.roomStateConfig, _config);

   this.ensurePropertyExists('user-override-state', 'stateproperty', { initialValue: 'not-active',
                                                                       states: [{ name: "not-active", source: { event: "room-switch-event", nextState: "active" }},
                                                                                { name: "active", source: { event: "room-switch-event", nextState: "not-active" },
                                                                                  timeout: { "duration": this.overrideTimeout, "nextState": "not-active" }} ]}, _config);
}

util.inherits(Room, Thing);

function nameExists(_objArray, _name) {

   for (var i = 0; i < _objArray.length; ++i) {

      if (_objArray[i].name === _name) {
         return true;
      }
   }

   return false;
}

module.exports = exports = Room;
