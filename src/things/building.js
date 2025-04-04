var util = require('util');
var Location = require('./location');

// Please provide inputs
// users - users that will use the building
// bedrooms - bedrooms the users will sleep in
// daylight - daylight true (dark property is created as the inverse of daylight)

// Please define properties for automated functionality
// low-light - true when light levels are low enough to switch on lights
// <user>-present - property representing a user being present in the building

// Please define events for automated functionality
// enter-evening-event - when this event is fired, evening-possible will be set to true. Rooms enter evening mode, if low-light is true

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


function Building(_config, _parent) {
   Location.call(this, _config, _parent);
   this.thingType = "building";

   this.bedtimeTimeout = (_config.hasOwnProperty('bedtimeTimeout')) ? _config.bedtimeTimeout : 3600 + 1800;

   this.userStateConfigs = [];
   var allUsersAwayConfig = { "name": "all-users-away", "type": "andproperty", "initialValue": true, "sources": [] };
   var someUsersInBedConfig = { "name": "some-users-in-bed", "type": "orproperty", "initialValue": false, "sources": [] };
   var allUsersInBedConfig = { "name": "all-users-in-bed", "type": "andproperty", "initialValue": false, "sources": [] };
   var userAwokenConfig = { "name": "user-awoken", "type": "event", "sources": [] };

   this.ensurePropertyExists("dark", 'property',
                             { "name": "dark", "initialValue": false, "writable": false,
                               "source": { "property": "daylight", "transform": "!$value" }}, _config);

   for (var i = 0; i < this.users.length; ++i) {
      this.userStateConfigs.push({});
      this.userStateConfigs[i] = {
         "name": this.users[i].name+"-user-state",
         "type": "stateproperty",
         "initialValue": "not-present",
         "states": [
            {
               "name": "not-present",
               "sources": [{ "property": this.users[i].name+"-present", "value": true, "nextState": "present" }],
               "action": { "event": "user-left", "value": this.users[i].name }
            },
            {
               "name": "present",
               "sources": [{ "property": this.users[i].name+"-present", "value": false, "nextState": "not-present" }],
               "action": { "guard": { "previousState": "not-present"}, "event": "user-arrived", "value": this.users[i].name }
            },
            {
               "name": "in-bed",
               "sources": [],
               "actions": [ { "event": "user-went-to-bed", "value": this.users[i].name }, { "property": this.users[i].name+"-present", "value": true } ]
            }
         ]
      };

      this.ensurePropertyExists(this.users[i].name+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);
      this.users[i].ensurePropertyExists(this.name+"-building-state", 'property', { "initialValue": 'not-present', "source": { "uName": this.uName, "property": this.users[i].name+"-user-state" }}, {});

      allUsersAwayConfig.sources.push({ "property": this.users[i].name+"-user-state", "transform": "$value===\"not-present\"" });
      allUsersInBedConfig.sources.push({ "property": this.users[i].name+"-user-state", "transform": "$value!==\"present\"" });
      someUsersInBedConfig.sources.push({ "property": this.users[i].name+"-user-state", "transform": "$value===\"in-bed\"" });
   }

   allUsersInBedConfig.sources.push({ "property": "some-users-in-bed" });

   // user events
   this.ensureEventExists("user-awoken", "event", userAwokenConfig);

   // user properties
   this.ensurePropertyExists("all-users-away", 'andproperty', allUsersAwayConfig, _config);
   this.ensurePropertyExists("all-users-in-bed", 'andproperty', allUsersInBedConfig, _config);
   this.ensurePropertyExists("some-users-in-bed", 'orproperty', someUsersInBedConfig, _config);

   this.ensurePropertyExists("users-state", "stateproperty",
                             { initialValue: "empty",
                               states: [ { name: "empty",
                                           source: { property: "all-users-away", value: false, nextState: "occupied-awake" }},

                                         { name: "occupied-awake",
                                           sources: [{ property: "some-users-in-bed", value: true, nextState: "occupied-going-to-bed" },
                                                     { property: "all-users-away", value: true, nextState: "empty" }]},

                                         { name: "occupied-going-to-bed",
                                           sources: [{ property: "all-users-in-bed", value: true, nextState: "occupied-asleep" },
                                                     { property: "some-users-in-bed", value: false, nextState: "occupied-awake" },
                                                     { property: "all-users-away", value: true, nextState: "empty" }]},

                                         { name: "occupied-asleep",
                                           sources: [{ property: "all-users-in-bed", value: false, nextState: "occupied-may-be-waking-up" },
                                                     { event: "user-arrived", nextState: "user-arrived-while-others-asleep" },
                                                     { event: "user-awoken", nextState: "occupied-waking-up" },
                                                     { property: "all-users-away", value: true, nextState: "empty" }] },

                                         { name: "user-arrived-while-others-asleep",
                                           sources: [{ property: "all-users-in-bed", value: false, nextState: "occupied-going-to-bed", "action": { "property": "evening-possible", "value": true }}],
                                           timeout: { duration: 1, nextState: "occupied-going-to-bed"} }, // Hack because all-users-in-bed not updated yet

                                         { name: "occupied-may-be-waking-up",
                                           sources: [{ event: "user-arrived", nextState: "occupied-going-to-bed" },
                                                     { event: "user-awoken", nextState: "occupied-waking-up" },
                                                     { property: "all-users-in-bed", value: true, nextState: "occupied-asleep" }],
                                           timeout: { duration: 2, nextState: "occupied-going-to-bed" } },

                                         { name: "occupied-waking-up",
                                           sources: [{ property: "some-users-in-bed", value: false, nextState: "occupied-awake" },
                                                     { property: "all-users-away", value: true, nextState: "empty" }] }] }, _config);

   // Movement property
   var movementConfig = { "name": "movement", "type": "orproperty", "initialValue": false, "sources": [] };
   var anyUsersSensitiveConfig = { "name": "any-users-sensitive", "type": "orproperty", "initialValue": false, "sources": [] };

   var eveningPossibleConfig = { "initialValue": false, "sources": [{ "event": "enter-evening-event", "transform": "true" },
                                                                    { "property": "night-time", "value": true, "transform": "false" }]};

   this.ensurePropertyExists("evening-possible", 'property', eveningPossibleConfig, _config);
   this.ensurePropertyExists("movement", "orproperty", movementConfig, _config);
   this.ensurePropertyExists("any-users-sensitive", "orproperty", anyUsersSensitiveConfig, _config);

   // night-time property
   this.ensurePropertyExists("night-time", 'property', { intialValue: false, source: { property: "users-state", transform: "$value===\"occupied-asleep\"" }}, _config);

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
            "sources": [{ "property": "confirmed-alarm", "value": false, "nextState": "not-armed" },
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

util.inherits(Building, Location);

// Called when current state required
Building.prototype.export = function(_exportObj) {
   Location.prototype.export.call(this, _exportObj);
};

// Called when current state required
Building.prototype.import = function(_importObj) {
   Location.prototype.import.call(this, _importObj);
};

Building.prototype.coldStart = function() {
   Location.prototype.coldStart.call(this);
};

Building.prototype.hotStart = function() {
   Location.prototype.hotStart.call(this);
};

// Something wants to watch (and possibly write to) several properties in this service node (read) - called from sourcelistener
Building.prototype.propertySubscribedTo = function(_property, _subscription, _exists, _firstSource) {
   console.log(this.uName + ": Property subscription() for " + _property);

   if (_firstSource) {
      this.processSubscription(_subscription);
   }
};

// Something wants to watch (and possibly raise towards) several events in this service node (read) - called from sourcelistener
Building.prototype.eventSubscribedTo = function(_eventName, _subscription, _firstSource) {
   console.log(this.uName + ": Event subscription() for" + _eventName);

   if (_firstSource) {
      this.processSubscription(_subscription);
   }
};

// Something does not want to watch a property anymore - called from sourcelistener
Building.prototype.propertySubscriptionRemoval = function(_property, _subscription, _exists, _lastSource) {
   console.log(this.uName + ": Property subscription() for " + _property);

   if (_lastSource) {
      this.processSubscriptionRemoval(_subscription);
   }
};

// Something does not want to watch an event anymore - called from sourcelistener
Building.prototype.eventSubscriptionRemoval = function(_eventName, _subscription, _lastSource) {
   console.log(this.uName + ": Event subscription() for" + _eventName);

   if (_lastSource) {
      this.processSubscriptionRemoval(_subscription);
   }
};

Building.prototype.processSubscription = function(_subscription) {

   if (!_subscription.hasOwnProperty("roomType")) {
      return;
   }

   if (_subscription.roomType === "room") {
      this.properties["movement"].addNewSource({ "uName": _subscription.listeningSource, "property": "movement" });
   }
   else if (_subscription.roomType === "bedroom") {

      for (var i = 0; i < this.users.length; ++i) {
         var listen = _subscription.hasOwnProperty("users") ? _subscription.roomUsers.includes(this.users[i].uName) : true;

         if (listen) {
            this.properties[this.users[i].name+"-user-state"].getState("not-present").addNewSource({ "uName": _subscription.listeningSource, "property": this.users[i].name+"-in-bed",
                                                                                                     "value": true, "nextState": "in-bed" });

            this.properties[this.users[i].name+"-user-state"].getState("present").addNewSource({ "uName": _subscription.listeningSource, "property": this.users[i].name+"-in-bed",
                                                                                                 "value": true, "nextState": "in-bed" });

            this.properties[this.users[i].name+"-user-state"].getState("in-bed").addNewSource({ "uName": _subscription.listeningSource, "property": this.users[i].name+"-in-bed",
                                                                                                "value": false, "nextState": "present" });

            this.events["user-awoken"].addNewSource({ "uName": _subscription.listeningSource, "event": this.users[i].name+"-awoken" });
         }
      }

      this.properties["movement"].addNewSource({ "uName": _subscription.listeningSource, "property": "movement" });
      this.properties["any-users-sensitive"].addNewSource({ "uName": _subscription.listeningSource, "property": "users-sensitive" });
      this.properties["evening-possible"].addNewSource({ "uName": _subscription.listeningSource, "event": "cancel-bedtime-event", "transform": "true" });
   }

};

Building.prototype.processSubscriptionRemoval = function(_subscription) {

   if (!_subscription.hasOwnProperty("roomType")) {
      return; 
   }

   if ((_subscription.roomType === "room")) {
      this.properties["movement"].removeExistingSource({ "uName": _subscription.listeningSource, "property": "movement" }, _subscription);
   }
   else if (_subscription.roomType === "bedroom") {

      for (var i = 0; i < this.users.length; ++i) {
         var listening = _subscription.hasOwnProperty("users") ? _subscription.roomUsers.includes(this.users[i].uName) : true;

         if (listening) {
            this.properties[this.users[i].name+"-user-state"].getState("not-present").removeExistingSource({ "uName": _subscription.listeningSource, "property": this.users[i].name+"-in-bed",
                                                                                                           "value": true, "nextState": "in-bed" }, _subscription);

            this.properties[this.users[i].name+"-user-state"].getState("present").removeExistingSource({ "uName": _subscription.listeningSource, "property": this.users[i].name+"-in-bed",
                                                                                                         "value": true, "nextState": "in-bed" }, _subscription);

            this.properties[this.users[i].name+"-user-state"].getState("in-bed").removeExistingSource({  "uName": _subscription.listeningSource, "property": this.users[i].name+"-in-bed",
                                                                                                         "value": false, "nextState": "present" }, _subscription);

            this.events["user-awoken"].removeExistingSource({ "uName": _subscription.listeningSource, "event": this.users[i].name+"-awoken" }, _subscription);
         }
      }
   
      this.properties["movement"].removeExistingSource({ "uName": _subscription.listeningSource, "property": "movement" }, _subscription);
      this.properties["any-users-sensitive"].removeExistingSource({ "uName": _subscription.listeningSource, "property": "users-sensitive" }, _subscription);
      this.properties["evening-possible"].removeExistingSource({ "uName": _subscription.listeningSource, "event": "cancel-bedtime-event", "transform": "true" }, _subscription);
   }
};

module.exports = exports = Building;
