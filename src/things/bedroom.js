var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement - true when there is movement detected (room.js)
// low-light - true when light levels are low enough to switch on lights (room.js)
// pre-wake-up-event - event indicating wake up start up sequence (e.g. sunrise ramp)
// wake-up-event - event indicating wake up alarm call
// <username>-switch-event - let each user control their own readiness for bed
// room-switch-event - room entrance switch
// cancel-bedtime-event - cancel the bedtime sequence and return to normal motion sensing
// pre-wake-up-duration - optional timer to automatically move from pre-wake-up to wake-up (wake-up-event not required when this is defined as > -1 i.e. infinate)
// awake-in-bed-duration - optional timer to automatically move from awake-in-bed to not-present
// reading-in-bed-duration - optional timer to automatically move from reading-in-bed to asleep

// Resulting <username>-user-state (s)
// not-present - user not present in the bedroom
// reading-in-bed - user present and reading - other users are either not present or reading too
// reading-in-bed-others-asleep - user present reading - one or more other users are asleep in this bedroom
// asleep-in-bed - user fasto
// waking-in-bed - pre-alarm sequence started
// awake-in-bed - wake up event has happened

function Bedroom(_config, _parent) {
   this.overrideTimeout = (_config.hasOwnProperty("overrideProperty")) ? _config.overrideProperty : 600;
   _config.userOverrideConfig =  { initialValue: 'not-active',
                                   states: [{ name: "not-active", priority: 0,
                                              sources: [{ guard: { active: false, property: "night-time", value: false }, event: "room-switch-event", nextState: "active" },
                                                        { guard: { active: false, property: "night-time", value: true }, event: "room-switch-event", nextState: "may-need-to-cancel-bedtime" }] },
                                                       // { guard: { active: false, property: "night-time", value: true }, event: "room-switch-event", nextState: "cancel-bedtime" }] },
                                            { name: "active", priority: 8, source: { event: "room-switch-event", nextState: "not-active" },
                                              timeout: { property: "override-timeout", "nextState": "not-active" }},
                                            { name: "may-need-to-cancel-bedtime", priority: 10,
                                              source: { event: "room-switch-event", action: { event: "cancel-bedtime-event" }, nextState: "not-active"},
                                              timeout: { "duration": 0.75, "nextState": "not-active" }} ]};
                                            //{ name: "cancel-bedtime", priority: 16, action: { event: "cancel-bedtime-event" },
                                              //timeout: { "duration": 0.1, "nextState": "not-active" }} ]};

   _config.roomStates = [{ name: "no-users-present-day", priority: 0}, { name: "users-present-day", priority: 0},
                         { name: "no-users-present-dull-day", priority: 0}, { name: "users-present-dull-day", priority: 5},
                         { name: "no-users-present-evening", priority: 0}, { name: "users-present-evening", priority: 5},
                         { name: "no-users-present-night", priority: 0}, { name: "users-present-night", priority: 0}];

   Room.call(this, _config, _parent);

   this.ensurePropertyExists("pre-wake-up-duration", "property", { initialValue: -1 }, _config);

   if (_config.hasOwnProperty('user')) {
      _config.users = [ _config.user ];
   }

   this.users = [];
   this.userStateConfigs = [];

   this.awakeInBedTimeout = _config.hasOwnProperty("awakeInBedTimeout") ? _config.awakeInBedTimeout : 60*30;
   this.ensurePropertyExists("awake-in-bed-duration", "property", { initialValue: this.awakeInBedTimeout }, _config);

   this.readingInBedTimeout = _config.hasOwnProperty("readingInBedTimeout") ? _config.readingInBedTimeout : -1;
   this.ensurePropertyExists("reading-in-bed-duration", "property", { initialValue: this.readingInBedTimeout }, _config);

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].uName));
   }

   this.usersPresentAndAwakeConfig = { initialValue: false, sources: [] };
   this.usersPresentAndAsleepConfig = { initialValue: false, sources: [] };
   this.usersPresentAndInBedConfig = { initialValue: false, sources: [] };

   this.usersInBuildingConfig = { initialValue: false, sources: [] };

   this.bedStatusConfig = { name: "bed-state", initialValue: "empty" };
   this.bedFullConfig = { initialValue: false, sources: [] };

   for (var i = 0; i < _config.users.length; ++i) {
      this.userStateConfigs.push({});
      this.userStateConfigs[i] = {
         "name": this.users[i].name+"-user-state",
         "type": "stateproperty",
         "initialValue": "not-present",
         "ignoreControl": true,
         "takeControlOnTransition": true,
         "states": [
            {
               "name": "not-present", "priority": 0,
               "sources": [ { "property": "evening-possible", "value": true, "nextState": "not-present-evening" },
                            { "event": this.users[i].name+"-switch-event", "nextState": "initial-reading-in-bed" }]
            },
            {
               "name": "not-present-evening", "priority": 0,
               "sources": [{ "event": this.users[i].name+"-switch-event", "nextState": "initial-reading-in-bed" },
                           //{ "guard": { active: false, property: "night-time", value: true }, "event": this.users[i].name+"-switch-event", "nextState": "initial-reading-in-bed" },
                           { "event": "room-switch-event", "nextState": "room-switch-touched" },
                           { "guard": { "active": false, "property": this.users[i].name+"-in-building", "value": false }, "property": "evening-possible", "value": false, "nextState": "not-present" },
                           { "guard": { "active": false, "property": this.users[i].name+"-in-building", "value": true }, "property": "evening-possible", "value": false, "nextState": "asleep-in-bed" }]
            },
            {
               "name": "room-switch-touched", "priority": 10,
               "sources": [{ "property": "night-time", "value": true, "nextState": "reading-in-bed" },
                           { "property": "night-time", "value": false, "nextState": "not-present" }]
            },
            {
               "name": "initial-reading-in-bed", "priority": 10,
               "sources": [{ "event": this.users[i].name+"-switch-event", "nextState": "asleep-in-bed" },
                           { "event": "cancel-bedtime-event", "nextState": "cancelling-bedtime"}],
               "actions": [{ "property": "night-time", "value": true }],
               "timeout": { "from": [ "reading-in-bed", "reading-in-bed-others-asleep" ], "property": "reading-in-bed-duration", "nextState": "asleep-in-bed" }
            },
            {
               "name": "reading-in-bed", "priority": 10,
               "sources": [{ "event": this.users[i].name+"-switch-event", "nextState": "asleep-in-bed" },
                           { "event": "cancel-bedtime-event", "nextState": "cancelling-bedtime"}],
               "timeout": { "from": [ "initial-reading-in-bed", "reading-in-bed-others-asleep" ], "property": "reading-in-bed-duration", "nextState": "asleep-in-bed" }
            },
            {
               "name": "reading-in-bed-others-asleep", "priority": 10,
               "sources": [{ "event": this.users[i].name+"-switch-event", "nextState": "asleep-in-bed" },
                           { "event": "cancel-bedtime-event", "nextState": "cancelling-bedtime"}],
               "timeout": { "from": [ "initial-reading-in-bed", "reading-in-bed" ], "property": "reading-in-bed-duration", "nextState": "asleep-in-bed" }
            },
            {
               "name": "asleep-in-bed", "priority": 10,
               "sources": [{ "event": this.users[i].name+"-switch-event", "nextState": "reading-in-bed" },
                           { "event": "pre-wake-up-event", "nextState": "waking-up-in-bed"},
                           { "event": "wake-up-event", "nextState": "awake-in-bed"},
                           { "event": "cancel-bedtime-event", "nextState": "cancelling-bedtime"}],
               "schedule": { "name": "wake-up-event", "rules": [ "0 12 * * *" ]}
            },
            {
               "name": "waking-up-in-bed", "priority": 10,
               "sources": [{ "event": "wake-up-event", "nextState": "awake-in-bed" },
                          { "event": "cancel-bedtime-event", "nextState": "cancelling-bedtime"}],
               "timeout": { "property": "pre-wake-up-duration", "nextState": "awake-in-bed" }
            },
            {
               "name": "awake-in-bed", "priority": 10,
               "timeout": { "property": "awake-in-bed-duration", "nextState": "not-present" },
               "sources": [{ "event": "cancel-bedtime-event", "nextState": "cancelling-bedtime"}],
               "actions": [{ "property": "night-time", "value": false }]
            },
            {
               "name": "cancelling-bedtime", "priority": 10,
               "timeout": { "duration": 0.5, "nextState": "not-present" },
               "actions": [{ "property": "night-time", "value": false }]
            }
         ]
      };

      /*if (this.readingInBedTimeout != -1) {
         this.userStateConfigs[i].states[3].timeout = { "from": [ "reading-in-bed", "reading-in-bed-others-asleep" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
         this.userStateConfigs[i].states[4].timeout = { "from": [ "initial-reading-in-bed", "reading-in-bed-others-asleep" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
         this.userStateConfigs[i].states[5].timeout = { "from": [ "initial-reading-in-bed", "reading-in-bed" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
      }*/

      for (var j = 0; j < this.users.length; ++j) {

         if (i !== j) {
            this.userStateConfigs[i].states[3].sources.push({ "property": this.users[j].name+"-user-state", "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[4].sources.push({ "property": this.users[j].name+"-user-state", "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[5].sources.push({ "property": this.users[j].name+"-user-state", "value": "reading-in-bed", "nextState": "reading-in-bed" });
            this.userStateConfigs[i].states[5].sources.push({ "property": this.users[j].name+"-user-state", "value": "reading-in-bed-others-asleep", "nextState": "reading-in-bed" });
         }
      }

      this.ensurePropertyExists(this.users[i].name+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);

      this.ensurePropertyExists(this.users[i].name+"-asleep", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].name+"-user-state",
                                                                     "transform": "($value === \"asleep-in-bed\") || ($value === \"waking-up-in-bed\")" }},  _config);

      this.ensurePropertyExists(this.users[i].name+"-present", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].name+"-user-state",
                                                                     "transform": "($value !== \"not-present\") && ($value !== \"not-present-evening\")" }},  _config);

      this.ensurePropertyExists(this.users[i].name+"-in-bed", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].name+"-user-state",
                                                                     "transform": "($value !== \"not-present\") && ($value !== \"not-present-evening\") && ($value !== \"awake-in-bed\")" }},  _config);

      this.ensurePropertyExists(this.users[i].name+"-present-and-awake", 'andproperty',
                                { "initialValue": false, "sources": [{ "property": this.users[i].name+"-asleep", "transform": "!$value" },
                                                                     { "property": this.users[i].name+"-in-bed", "transform": "!$value" },
                                                                     { "property": this.users[i].name+"-in-building" } ]},  _config);

      this.ensurePropertyExists(this.users[i].name+"-present-and-asleep", 'andproperty',
                                { "initialValue": false, "sources": [{ "property": this.users[i].name+"-asleep" },
                                                                     { "property": this.users[i].name+"-in-building" } ]},  _config);

      this.ensurePropertyExists(this.users[i].name+"-present-and-in-bed", 'andproperty',
                                { "initialValue": false, "sources": [{ "property": this.users[i].name+"-in-bed" },
                                                                     { "property": this.users[i].name+"-in-building" } ]},  _config);

      this.ensurePropertyExists(this.users[i].name+"-in-building", 'property',
                                { "initialValue": false, "source": { "uName": this.buildingName, "property": this.users[i].name+"-user-state",
                                                                     "transform": "$value !== \"not-present\"" }}, _config);

      this.usersPresentAndAwakeConfig.sources.push({ property: this.users[i].name+"-present-and-awake" });
      this.usersPresentAndAsleepConfig.sources.push({ property: this.users[i].name+"-present-and-asleep" });
      this.usersPresentAndInBedConfig.sources.push({ property: this.users[i].name+"-present-and-in-bed" });

      this.usersInBuildingConfig.sources.push({ property: this.users[i].name+"-in-building" });

      this.bedFullConfig.sources.push({ property: this.users[i].name+"-in-bed" });
      //this.userMonitorConfig.states[0].sources.push({ "guards": [{ active: false, property: "night-time", value: false }, { active: false, property: "evening-possible", value: false }],
                                                      //"event": this.users[i].name+"-switch-event", "nextState": "room-switch-event-required" });
   }

   this.ensurePropertyExists("users-in-building", 'orproperty', this.usersInBuildingConfig, _config);

   this.ensurePropertyExists("bed-part-full", 'xorproperty', this.bedFullConfig, _config);
   this.ensurePropertyExists("bed-full", 'andproperty', this.bedFullConfig, _config);
   this.ensurePropertyExists("night-time", 'property', { initialValue: false, source: { uName: this.buildingName, property: "night-time" } }, _config);

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

   //this.userMonitorConfig.states.push({ name: "room-switch-event-required", priority: 15, action: { "event": "room-switch-event" }, "timeout": { "duration": 0.1, "nextState": "PREVIOUS-STATE" }}),
   //this.ensurePropertyExists("monitor-users", 'stateproperty', this.userMonitorConfig, _config);
}

util.inherits(Bedroom, Room);

// Called when current state required
Bedroom.prototype.export = function(_exportObj) {
   Room.prototype.export.call(this, _exportObj);
};

// Called when current state required
Bedroom.prototype.import = function(_importObj) {
   Room.prototype.import.call(this, _importObj);
};

Bedroom.prototype.coldStart = function() {
   Room.prototype.coldStart.call(this);
};

Bedroom.prototype.hotStart = function() {
   Room.prototype.hotStart.call(this);
};

module.exports = exports = Bedroom;
