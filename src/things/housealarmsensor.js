var util = require('util');
var Thing = require('../thing');

// Config
// activeTimeout - minimum seconds an active state will last  

// Please define properties for automated functionality
// raw-active - boolean - true when sensor is active - EOL not shorted
// tamper - boolean - true when tamper condition detected
// fault - boolean - true when sensor has a fault

// Resulting properties 
// active - boolean - true when sensor is active (minimum timeout applies) - uses raw-active as source

function HouseAlarmSensor(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "house-alarm-sensor";

   this.activeTimeout = (_config.hasOwnProperty("activeTimeout")) ? _config.activeTimeout : 600;

   this.ensurePropertyExists('active-state', 'stateproperty', { name: "active-state", type: "stateproperty", initialValue: "inactive", 
                                                                       states: [{ name: "inactive", source: { property: "raw-active", "value": true, nextState: "active" } },
                                                                                { name: "active", timeout: { duration: this.activeTimeout, nextState: "inactive" },
                                                                                                  source: { property: "raw-active", "value": true, nextState: "active" }} ]}, _config);

   this.ensurePropertyExists('active', 'property', { name: "active", type: "property", initialValue: false, source: { property: "active-state", transform: "($value === \"active\")" }}, _config);
}

util.inherits(HouseAlarmSensor, Thing);

// Called when current state required
HouseAlarmSensor.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
HouseAlarmSensor.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

HouseAlarmSensor.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

HouseAlarmSensor.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = HouseAlarmSensor;
