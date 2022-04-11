var util = require('util');
var Thing = require('../thing');

// Please define properties for automated functionality
// users - users who can occupy the car
// <user>-aboard - true or false
// locations - meaningful locations where a user can be present (property is <location>:<username>-present)

// Events listened to
// <user>-onboarded - user has onboarded to the car
// <user>-offboarded - user has onboarded from the car

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
               sources: [ { property: this.users[i].name+"-aboard", value: true, nextState: "aboard" },
                          { event: this.users[i].name+"-onboarded", nextState: "onboarding" }]
            },
            {
               name: "aboard", "priority": 0,
               sources: [ { property: this.users[i].name+"-aboard", value: false, nextState: "not-present" },
                          { event: this.users[i].name+"-offboarded", nextState: "offboarding" }]
            },
            {
               name: "onboarding", "priority": 0,
               action: { property: this.users[i].name+"-aboard", value: true },
               timeout: { duration: 0.1, nextState: "not-present" }
            },
            {
               name: "offboarding", "priority": 0,
               action: { property: this.users[i].name+"-aboard", value: false },
               timeout: { duration: 0.1, nextState: "aboard" }
            }
         ]
      };

      for (var z = 0; z < this.locations.length; ++z) {
         var locName = this.locations[z].uName.replace(/:/g, "-").replace("--", "");
         userStateConfigs[i].states[1].sources.push({ uName: this.locations[z].uName, property: this.users[i].name+"-present", value: true, nextState: "aboard-at-" + locName });

         var aboardAtConfig = { name: "aboard-at-" + locName,
                                sources: [{ property: this.users[i].name+"-aboard", value: false, nextState: "not-present" },
                                          { event: this.users[i].name+"-offboarded", nextState: "offboarding" },
                                          { uName: this.locations[z].uName, property: this.users[i].name+"-present", value: false, nextState: "aboard" }]}

         if (this.locations[z].hasOwnProperty("autoOffboard")) {
            aboardAtConfig.timeout = { duration: this.locations[z].autoOffboard, nextState: "offboarding" };
         }

         userStateConfigs[i].states.push(util.copy(aboardAtConfig, true));
      }

      this.ensurePropertyExists(this.users[i].name+"-user-state", 'stateproperty', userStateConfigs[i], _config);

      occupiedConfig.sources.push({ property: this.users[i].name+"-aboard" });

      this.ensurePropertyExists(this.users[i].name+"-aboard", 'property', { initialValue: false }, _config);
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

// Called when current state required
Car.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Car.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Car.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

Car.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = Car;
