var util = require('util');
var Room = require('./room');

// Please define properties for automated functionality
// movement-pir - true when there is movement detected (room.js)
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

   Room.call(this, _config);

   if (_config.hasOwnProperty('user')) {
      _config.users = [ _config.user ];
   }

   this.users = [];
   this.userStateConfigs = [];
   this.awakeInBedTimeout = _config.hasOwnProperty("awakeInBedTimeout") ? _config.awakeInBedTimeout : 60*30;
   this.readingInBedTimeout = _config.hasOwnProperty("readingInBedTimeout") ? _config.readingInBedTimeout : -1;

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findSource(_config.users[u].uName));
   }

   for (var i = 0; i < _config.users.length; ++i) {
      this.userStateConfigs.push({});
      this.userStateConfigs[i] = {
         "name": this.users[i].sName+"-user-state",
         "type": "stateproperty",
         "initialValue": "not-present",
         "states": [
            {
               "name": "not-present",
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "initial-reading-in-bed" },
                           { "event": "room-switch-event", "nextState": "reading-in-bed" }]
            },
            {
               "name": "initial-reading-in-bed",
               "priority": 4,
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" }],
               "targets": [{ "property": "night-time", "value": true }]
            },
            {
               "name": "reading-in-bed",
               "priority": 4,
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" }]
            },
            {
               "name": "reading-in-bed-others-asleep",
               "priority": 4,
               "sources": [{ "event": this.users[i].sName+"-switch-event", "nextState": "asleep-in-bed" }]
            },
            {
               "name": "asleep-in-bed",
               "priority": 4,
               "sources": [ { "event": this.users[i].sName+"-switch-event", "nextState": "reading-in-bed" },
                            { "event": "pre-wake-up-event", "nextState": "waking-up-in-bed"},
                            { "event": "wake-up-event", "nextState": "awake-in-bed"} ]
            },
            {
               "name": "waking-up-in-bed",
               "priority": 4,
               "source": { "event": "wake-up-event", "nextState": "awake-in-bed" }
            },
            {
               "name": "awake-in-bed",
               "timeout": { "duration": this.awakeInBedTimeout, "nextState": "not-present" },
               "priority": 4,
               "source": { "event": "wake-up-event", "nextState": "awake-in-bed" },
               "targets": [{ "property": "night-time", "value": false }]
            }
         ]
      };

      if (this.readingInBedTimeout != -1) {
         this.userStateConfigs[i].states[1].timeout = { "from": [ "reading-in-bed", "reading-in-bed-others-asleep" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
         this.userStateConfigs[i].states[2].timeout = { "from": [ "initial-reading-in-bed", "reading-in-bed-others-asleep" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
         this.userStateConfigs[i].states[3].timeout = { "from": [ "initial-reading-in-bed", "reading-in-bed" ], "duration": this.readingInBedTimeout, "nextState": "asleep-in-bed" };
      }

      for (var j = 0; j < this.users.length; ++j) {

         if (i !== j) {
            this.userStateConfigs[i].states[1].sources.push({ "property": this.users[j].sName+"-user-state", "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[2].sources.push({ "property": this.users[j].sName+"-user-state", "value": "asleep-in-bed", "nextState": "reading-in-bed-others-asleep" });
            this.userStateConfigs[i].states[3].sources.push({ "property": this.users[j].sName+"-user-state", "value": "reading-in-bed", "nextState": "reading-in-bed" });
            this.userStateConfigs[i].states[3].sources.push({ "property": this.users[j].sName+"-user-state", "value": "reading-in-bed-others-asleep", "nextState": "reading-in-bed" });
         }
      }

      this.ensurePropertyExists("night-time", 'property', { initialValue: false }, _config);
      this.ensurePropertyExists(this.users[i].sName+"-user-state", 'stateproperty', this.userStateConfigs[i], _config);

      this.ensurePropertyExists(this.users[i].sName+"-in-bed", 'property',
                                { "initialValue": false, "source": { "property": this.users[i].sName+"-user-state", "transform": "$value !== \"not-present\"" }},  _config);
   }
}

util.inherits(Bedroom, Room);


module.exports = exports = Bedroom;
