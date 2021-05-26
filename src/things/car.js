var util = require('util');
var Thing = require('../thing');

// Please define properties for automated functionality
// users - users who can occupy the car
// <user>-aboard - true or false
// locations - meaningful locations where a user can be present (property is <location>:<username>-present)

// Resulting properties
// car-state - empty or occupied
// occupied - true or false
// occupied-at-<location> - true or false
// <username>-user-state - "aboard" or "not-present"
// <username>-aboard - true or false
// <username>-aboard-at-<location> - true or false

function Car(_config, _parent) {
   Thing.call(this, _config, _parent);

   if (_config.hasOwnProperty('user')) {
      _config.users = [ _config.user ];
   }

   if (_config.hasOwnProperty('location')) {
      _config.locations = [ _config.location ];
   }

   this.users = [];
   this.locations = _config.hasOwnProperty("locations") ? _config.locations: [];

   this.ensurePropertyExists("car-state", 'stateproperty', 
                             { type: "stateproperty", initialValue: "empty", "ignoreControl": true, "takeControlOnTransition": true,
                               states: [{ name: "empty", sources: [{ property: "occupied",  value: "true", nextState: "occupied" }]},
                                        { name: "occupied", sources: [{ property: "occupied",  value: "false", nextState: "empty" }]} ]}, _config);

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].uName));
   }

   var userStateConfigs = [];
   var occupiedConfig = { initialValue: false, sources: [] };

   for (var i = 0; i < _config.users.length; ++i) {
      userStateConfigs.push({});
      userStateConfigs[i] = {
         "name": this.users[i].name+"-user-state",
         "type": "stateproperty",
         "initialValue": "not-present",
         "ignoreControl": true,
         "takeControlOnTransition": true,
         "states": [
            {
               name: "not-present", "priority": 0,
               sources: [ { property: this.users[i].name+"-aboard", value: true, nextState: "aboard" }]
            },
            {
               name: "aboard", "priority": 0,
               sources: [ { property: this.users[i].name+"-aboard", value: false, nextState: "not-present" }]
            }
         ]
      };

      for (var z = 0; z < this.locations.length; ++z) {
         var locName = this.locations[z].uName.replace(/:/g, "-").replace("--", "");
         userStateConfigs[i].states[1].sources.push({ uName: this.locations[z].uName, property: this.users[i].name+"-present", value: true, nextState: "aboard-in-" + locName });

         userStateConfigs[i].states.push({ name: "aboard-in-" + locName,
                                           sources: [{ property: this.users[i].name+"-aboard", value: false, nextState: "not-present" },
                                                     { uName: this.locations[z].uName, property: this.users[i].name+"-present", value: false, nextState: "aboard" }]});

      }

      this.ensurePropertyExists(this.users[i].name+"-user-state", 'stateproperty', userStateConfigs[i], _config);

      occupiedConfig.sources.push({ property: this.users[i].name+"-aboard" });
   }

   this.ensurePropertyExists("occupied", 'orproperty', occupiedConfig, _config);

   for (var s = 0; s < this.locations.length; ++s) {
      var occupiedAtConfig = { initialValue: false, sources: [] };
      var locName2 = this.locations[s].uName.replace(/:/g, "-").replace("--", "");

      for (var t = 0; t < _config.users.length; ++t) {
         var userAboardAtConfig = { initialValue: false, sources: [] };
         userAboardAtConfig.sources.push({ property: this.users[t].name + "-aboard"});
         userAboardAtConfig.sources.push({ "uName": this.locations[s].uName, property: this.users[t].name+"-present"});
         this.ensurePropertyExists(this.users[t].name+"-aboard-at-" + locName2, 'andproperty', userAboardAtConfig, _config);
         occupiedAtConfig.sources.push({ property: this.users[t].name+"-aboard-at-" + locName2 });
      }

      this.ensurePropertyExists("occupied-at-" + locName2, 'orproperty', occupiedAtConfig, _config);
   }
}

util.inherits(Car, Thing);

module.exports = exports = Car;
