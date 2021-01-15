var util = require('util');
var Thing = require('../thing');

// Config
// movementTimeout - how many seconds a movement should affect the room
// or movementTimeouts - object of timeouts for day-state { day, dull-day, evening, night }
//
// overrideTimeout - how many seconds the override should be in affect for

// Please define properties for automated functionality
// movement - true when there is movement detected
// low-light - true when light levels are low enough to switch on lights
// night-time - true when head to bed and no longer want any background lights
// users-sensitive -  true when users are sensitive to light or noise (may be  in adjacent rooms)
// room-switch-event - room entrance switch

// Resulting day-state
// day - normal daytime
// dull-day - daytime but with low light
// evening  - low light and late enough to be evening
// night - night time

// Resulting users-present-state
// no-users-present - no users detected in room for at least timeout period
// users-present - users detected within timeout period

// Resulting room-state
// no-users-present - no movement detected
// users-present - movement detected
// no-users-present-evening - no movement detected in low-light before bed-time (background lights)
// users-present-evening - movement detected in low-light before bed-time
// no-users-present-night - no movement detected in low-light after bed-time (night light)
// users-present-night - movement detected in low-light after bed-time (night light when users moving)
// no-users-present-dull-day - no movement detected in low-light after wake up call
// users-present-dull-day - movement detected in low-light after wake up call

// Resulting alarm-state
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

// Resulting users-sensitivity-state
// no-users-present-normal - no users present and no users are worried about lighting or noise
// users-present-normal - users present but no users are worried about lighting or noise
// no-users-present-sensitive - no users present but users are worried about lighting or noise
// users-present-sensitive - users present and users are worried about lighting or noise


function Room(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "room";
   this.overrideTimeout = (_config.hasOwnProperty("overrideTimeout")) ? _config.overrideTimeout : 900;

   if (_config.hasOwnProperty('movementTimeouts')) {
      this.movementTimeouts = _config.movementTimeouts;
   }
   else {
      var value = (_config.hasOwnProperty('movementTimeout')) ? _config.movementTimeout : 600;
      this.movementTimeouts = { "day": value, "dull-day": value, "evening": value, "night": value };
   }

   if (_config.hasOwnProperty('overrideTimeouts')) {
      this.overrideTimeouts = _config.overrideTimeouts;
   }
   else {
      var value = (_config.hasOwnProperty('overrideTimeout')) ? _config.overrideTimeout : 600;
      this.overrideTimeouts = { "day": value, "dull-day": value, "evening": value, "night": value };
   }

   this.buildingName = _config.building;

   this.roomStates = _config.hasOwnProperty("roomStates") ? _config.roomStates : [];
   this.sensitivityStates = _config.hasOwnProperty("sensitivityStates") ? _config.sensitivityStates : [{ name: "no-users-present-normal", priority: -1 }, { name: "users-present-normal", priority: -1 },
                                                                                                       { name: "no-users-present-sensitive", priority: 15 }, { name: "users-present-sensitive", priority: 15 } ];

   this.ensurePropertyExists('alarm-state', 'property', { source: { uName: this.buildingName, property: "alarm-state"}}, _config);
   this.ensurePropertyExists('evening-possible', 'property', { initialValue: false, source: { uName: this.buildingName, property: "evening-possible"}}, _config);
   this.ensurePropertyExists('movement-timeout', 'property', { initialValue: this.movementTimeouts.day }, _config);
   this.ensurePropertyExists('override-timeout', 'property', { initialValue: this.overrideTimeouts.day }, _config);

   this.ensurePropertyExists('day-state', 'stateproperty', { name: "day-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "day", 
                                                             states: [{ name: "day", sources: [{ property: "low-light", value: true, nextState: "dull-day" },
                                                                                               { property: "night-time", "value": true, nextState: "night" }],
                                                                                     actions: [{ property: "movement-timeout", value: this.movementTimeouts["day"] },
                                                                                               { property: "override-timeout", value: this.overrideTimeouts["day"] }]},
                                                                      { name: "dull-day", sources: [{ property: "low-light", "value": false, nextState: "day" },
                                                                                                    { property: "night-time", "value": true, nextState: "night" },
                                                                                                    { property: "evening-possible", "value": true, nextState: "evening" }],
                                                                                     actions: [{ property: "movement-timeout", value: this.movementTimeouts["dull-day"] },
                                                                                               { property: "override-timeout", value: this.overrideTimeouts["dull-day"] }]},
                                                                      { name: "evening", sources: [{ property: "night-time", "value": true, nextState: "night" },
                                                                                                   { property: "low-light", "value": false, nextState: "day" }],
                                                                                     actions: [{ property: "movement-timeout", value: this.movementTimeouts["evening"] },
                                                                                               { property: "override-timeout", value: this.overrideTimeouts["evening"] }]},
                                                                      { name: "night", sources: [{ property: "night-time", "value": false, nextState: "day" }],
                                                                                     actions: [{ property: "movement-timeout", value: this.movementTimeouts["night"] },
                                                                                               { property: "override-timeout", value: this.overrideTimeouts["night"] }] }] }, _config);

   this.ensurePropertyExists('users-present-state', 'stateproperty', { name: "users-present-state", type: "stateproperty", initialValue: "no-users-present", 
                                                                       states: [{ name: "no-users-present", source: { property: "movement", "value": true, nextState: "users-present" } },
                                                                                { name: "users-present", timeout: { property: "movement-timeout", nextState: "no-users-present" },
                                                                                                         source: { property: "movement", "value": true, nextState: "users-present" }} ]}, _config);

   this.ensurePropertyExists('room-state', 'combinestateproperty', { name: "room-state", type: "combinestateproperty", separator: "-", initialValue: "no-users-present-day",
                                                                     sources: [{ property: "users-present-state" }, { property: "day-state" }], states: this.roomStates }, _config);

   var userOverrideConfig = (_config.hasOwnProperty("userOverrideConfig")) ? _config.userOverrideConfig
                                                                           : { initialValue: 'not-active', takeControlOnTransition: true,
                                                                               states: [{ name: "not-active", priority: 0, source: { event: "room-switch-event", nextState: "active" }},
                                                                                        { name: "active", priority: 8, source: { event: "room-switch-event", nextState: "not-active" },
                                                                                          timeout: { property: "override-timeout", "nextState": "not-active" }} ]};

   this.ensurePropertyExists('user-override-state', 'stateproperty', userOverrideConfig, _config);

   if (this.hasProperty("users-sensitive")) {
      this.ensurePropertyExists('user-sensitivity-state', 'combinestateproperty', { name: "user-sensitivity-state", type: "combinestateproperty", takeControlOnTransition: true, "initialValue": "no-users-present-normal", separator: "-",
                                                                                    sources: [{ property: "users-present-state" },
                                                                                              { property: "users-sensitive", transformMap: { false: "normal", true: "sensitive" }}],
                                                                                    states: this.sensitivityStates }, _config);
   }
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
