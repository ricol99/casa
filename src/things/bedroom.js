var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement - true when there is movement detected (room.js)
// low-light - true when light levels are low enough to switch on lights (room.js)
// pre-wake-up-event - event indicating wake up start up sequence (e.g. sunrise ramp)
// wake-up-event - event indicating wake up alarm call
// <username>-switch-event - let each user control their own readiness for bed
// room-switch-event - room entrance switch

// Resulting <username>-user-state (s)
// not-present - user not present in the bedroom
// reading-in-bed - user present and reading - other users are either not present or reading too
// reading-in-bed-others-asleep - user present reading - one or more other users are asleep in this bedroom
// asleep-in-bed - user fasto
// waking-in-bed - pre-alarm sequence started
// awake-in-bed - wake up event has happened

function Bedroom(_config) {
   this.overrideTimeout = (_config.hasOwnProperty("overrideProperty")) ? _config.overrideProperty : 600;
   _config.userOverrideConfig =  { initialValue: 'not-active',
                                   states: [{ name: "not-active",
                                              source: { guard: { active: false, property: "night-time", value: false }, event: "room-switch-event", nextState: "active" }},
                                            { name: "active", source: { event: "room-switch-event", nextState: "not-active" },
                                              timeout: { property: "override-timeout", "nextState": "not-active" }} ]};
   Room.call(this, _config);

   if (_config.hasOwnProperty('user')) {
      _config.users = [ _config.user ];
   }

   this.users = [];
   this.userStateConfigs = [];
   this.awakeInBedTimeout = _config.hasOwnProperty("awakeInBedTimeout") ? _config.awakeInBedTimeout : 60*30;
   this.readingInBedTimeout = _config.hasOwnProperty("readingInBedTimeout") ? _config.readingInBedTimeout : -1;

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].uName));
   }

   this.usersPresentAndAwakeConfig = { initialValue: false, sources: [] };
   this.usersPresentAndAsleepConfig = { initialValue: false, sources: [] };
   this.usersPresentAndInBedConfig = { initialValue: false, sources: [] };

   this.usersInBuildingConfig = { initialValue: false, sources: [] };

   this.bedStatusConfig = { name: "bed-state", initialValue: "empty" };
   this.bedFullConfig = { initialValue: false, sources: [] };
   this.userMonitorConfig = { initialValue: "idle", states: [{ "name": "idle", sources: [] }] };

   for (var i = 0; i < _config.users.length; ++i) {
      this.userStateConfigs.push({});
      this.userStateConfigs[i] = {
         "name": this.users[i].sName+"-user-state",
         "type": "stateproperty",
         "initialValue": "not-present",
         "ignoreControl": true,
         "states": [
            {
               "name": "not-present",
               "sources": [{ "guard": { active: false, property: "evening-possible", value: true }, "event": this.users[i].sName+"-switch-event", "nextState": "initial-reading-in-bed" },
                           { "guard": { active: false, property: "night-time", value: true }, "event": this.users[i].sName+"-switch-event", "nextState": "initial-reading-in-bed" },
                           { "event": "room-switch-event", "nextState": "room-switch-touched" }],
               "schedule": { "rule": "5 2 * * *", "guard": { "active": false, "property": this.users[i].sName+"-in-building", "value": true }, "nextState": "asleep-in-bed" }
            },
            {
               "name": "room-switch-touched",
               "sources": [{ "property": "night-time", "value": true, "nextState": "reading-in-bed" },
                           { "property": "night-time", "value": false, "nextState": "not-present" }]
            },
            {
               "name": "initial-reading-in-bed",
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" }],
               "actions": [{ "property": "night-time", "value": true }]
            },
            {
               "name": "reading-in-bed",
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" }]
            },
            {
               "name": "reading-in-bed-others-asleep",
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" }]
            },
            {
               "name": "asleep-in-bed",
               "sources": [ { "event": this.users[i].sName+"-switch-event", "nextState": "reading-in-bed" },
                            { "event": "pre-wake-up-event", "nextState": "waking-up-in-bed"},
                            { "event": "wake-up-event", "nextState": "awake-in-bed"} ]
            },
            {
               "name": "waking-up-in-bed",
               "source": { "event": "wake-up-event", "nextState": "awake-in-bed" }
            },
            {
               "name": "awake-in-bed",
               "timeout": { "duration": this.awakeInBedTimeout, "nextState": "not-present" },
               "source": { "event": "wake-up-event", "nextState": "awake-in-bed" },
               "actions": [{ "property": "night-time", "value": false }]
            }
         ]
      };

      if (this.readingInBedTimeout != -1) {
         this.userStateConfigs[i].states[2].timeout = { "from": [ "reading-in-bed", "reading-in-bed-others-asleep" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
         this.userStateConfigs[i].states[3].timeout = { "from": [ "initial-reading-in-bed", "reading-in-bed-others-asleep" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
         this.userStateConfigs[i].states[4].timeout = { "from": [ "initial-reading-in-bed", "reading-in-bed" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
      }

      for (var j = 0; j < this.users.length; ++j) {

         if (i !== j) {
            this.userStateConfigs[i].states[2].sources.push({ "property": this.users[j].sName+"-user-state", "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[3].sources.push({ "property": this.users[j].sName+"-user-state", "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[4].sources.push({ "property": this.users[j].sName+"-user-state", "value": "reading-in-bed", "nextState": "reading-in-bed" });
            this.userStateConfigs[i].states[4].sources.push({ "property": this.users[j].sName+"-user-state", "value": "reading-in-bed-others-asleep", "nextState": "reading-in-bed" });
         }
      }

      this.ensurePropertyExists(this.users[i].sName+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);

      this.ensurePropertyExists(this.users[i].sName+"-asleep", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].sName+"-user-state",
                                                                     "transform": "($value === \"asleep-in-bed\") || ($value === \"waking-up-in-bed\")" }},  _config);

      this.ensurePropertyExists(this.users[i].sName+"-present", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].sName+"-user-state",
                                                                     "transform": "$value !== \"user-present\"" }},  _config);

      this.ensurePropertyExists(this.users[i].sName+"-in-bed", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].sName+"-user-state",
                                                                     "transform": "($value !== \"not-present\") && ($value !== \"awake-in-bed\")" }},  _config);

      this.ensurePropertyExists(this.users[i].sName+"-present-and-awake", 'andproperty',
                                { "initialValue": false, "sources": [{ "property": this.users[i].sName+"-asleep", "transform": "!$value" },
                                                                     { "property": this.users[i].sName+"-in-bed", "transform": "!$value" },
                                                                     { "property": this.users[i].sName+"-in-building" } ]},  _config);

      this.ensurePropertyExists(this.users[i].sName+"-present-and-asleep", 'andproperty',
                                { "initialValue": false, "sources": [{ "property": this.users[i].sName+"-asleep" },
                                                                     { "property": this.users[i].sName+"-in-building" } ]},  _config);

      this.ensurePropertyExists(this.users[i].sName+"-present-and-in-bed", 'andproperty',
                                { "initialValue": false, "sources": [{ "property": this.users[i].sName+"-in-bed" },
                                                                     { "property": this.users[i].sName+"-in-building" } ]},  _config);

      this.ensurePropertyExists(this.users[i].sName+"-in-building", 'property',
                                { "initialValue": false, "source": { "uName": this.buildingName, "property": this.users[i].sName+"-user-state",
                                                                     "transform": "$value !== \"not-present\"" }}, _config);

      this.usersPresentAndAwakeConfig.sources.push({ property: this.users[i].sName+"-present-and-awake" });
      this.usersPresentAndAsleepConfig.sources.push({ property: this.users[i].sName+"-present-and-asleep" });
      this.usersPresentAndInBedConfig.sources.push({ property: this.users[i].sName+"-present-and-in-bed" });

      this.usersInBuildingConfig.sources.push({ property: this.users[i].sName+"-in-building" });

      this.bedFullConfig.sources.push({ property: this.users[i].sName+"-in-bed" });
      this.userMonitorConfig.states[0].sources.push({ "guards": [{ active: false, property: "night-time", value: false }, { active: false, property: "evening-possible", value: false }],
                                                      "event": this.users[i].sName+"-switch-event", "nextState": "room-switch-event-required" });
   }

   this.ensurePropertyExists("users-in-building", 'orproperty', this.usersInBuildingConfig, _config);

   this.ensurePropertyExists("bed-part-full", 'xorproperty', this.bedFullConfig, _config);
   this.ensurePropertyExists("bed-full", 'andproperty', this.bedFullConfig, _config);
   this.ensurePropertyExists("night-time", 'property', { initialValue: false }, _config);

   this.ensurePropertyExists("some-present-users-awake", 'orproperty', this.usersPresentAndAwakeConfig, _config);
   this.ensurePropertyExists("some-present-users-asleep", 'orproperty', this.usersPresentAndAsleepConfig, _config);
   this.ensurePropertyExists("some-present-users-in-bed", 'orproperty', this.usersPresentAndInBedConfig, _config);

   this.ensurePropertyExists("all-present-users-awake", 'andproperty',
                             { initialValue: false, sources:[{ property: "some-present-users-awake"},
                                                             { property: "some-present-users-asleep", transform: "!$value" }] }, _config);

   this.ensurePropertyExists("all-present-users-asleep", 'andproperty',
                             { initialValue: false, sources:[{ property: "some-present-users-asleep"},
                                                             { property: "some-present-users-awake", transform: "!$value" }] }, _config);

   this.ensurePropertyExists("all-present-users-in-bed", 'andproperty',
                             { initialValue: false, sources:[{ property: "some-present-users-in-bed"},
                                                             { property: "some-present-users-awake", transform: "!$value" }] }, _config);


   this.ensurePropertyExists("users-sensitive", 'orproperty', { initialValue: false, sources: [{ property: "all-present-users-in-bed" },
                                                                                               { property: "some-present-users-asleep" }] }, _config);

   this.userMonitorConfig.states.push({ name: "room-switch-event-required", action: { "event": "room-switch-event" }, "timeout": { "duration": 0.5, "nextState": "PREVIOUS-STATE" }}),
   this.ensurePropertyExists("monitor-users", 'stateproperty', this.userMonitorConfig, _config);
}

util.inherits(Bedroom, Room);

module.exports = exports = Bedroom;
