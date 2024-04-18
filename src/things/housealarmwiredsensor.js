var util = require('util');
var HouseAlarmSensor = require('./housealarmsensor');

// Config
// mainEolResistance - Main EOL resistance
// activeEolResistance - Active EOL resistance
// faultEolResistance - Fault EOL resistance
// dividerResistance - Resistance of voltage divider resistor
// supplyVoltage - Voltage across sensor
// tolerance - tolerance (in %)
// activeTimeout - minimum seconds an active state will last  

// Please define properties for automated functionality
// sensor-voltage - current voltage of the sensor

// Resulting properties 
// raw-active - boolean - true when sensor is active - EOL not shorted
// active - boolean - true when sensor is active (minimum timeout applies) - uses raw-active as source
// tamper - boolean - true when tamper condition detected
// fault - boolean - true when sensor has a fault

function HouseAlarmWiredSensor(_config, _parent) {
   HouseAlarmSensor.call(this, _config, _parent);
   this.thingType = "house-alarm-wired-sensor";

   this.activeTimeout = (_config.hasOwnProperty("activeTimeout")) ? _config.activeTimeout : 600;
   this.targetRatios = { inactive: _config.dividerResistance / (_config.mainEolResistance + _config.dividerResistance),
                         active: _config.dividerResistance / (_config.mainEolResistance + _config.activeEolResistance + _config.dividerResistance) };

   if (_config.hasOwnProperty("faultEolResistance")) {
      this.targetRatios["fault"] = _config.dividerResistance / (_config.mainEolResistance + _config.faultEolResistance + _config.dividerResistance);
      this.targetRatios["fault-active"] = _config.dividerResistance / (_config.mainEolResistance + _config.activeEolResistance + _config.faultEolResistance + _config.dividerResistance);
   }

   this.targetVoltages = { tamper: 0 };

   for (var resistance in this.targetRatios) {
      this.targetVoltages[resistance] = _config.supplyVoltage * this.targetRatios[resistance];
   }

   this.boundaries = { };

   for (var state in this.targetVoltages) {

      if (this.targetVoltages.hasOwnProperty(state)) {
         var value = this.targetVoltages[state] - (this.targetVoltages[state] * (_config.tolerance / 100.0));
         this.boundaries[state] = (value > 0) ? value : 0;
      }
   }

   this.boundaries["tamper"] = 1 * (_config.tolerance /100.0);
   
   this.ensurePropertyExists('sensor-state', 'quantiseproperty', { quanta: this.boundaries, source: { property: "sensor-voltage"} }, _config);
   this.ensurePropertyExists('raw-active', 'property', { name: "raw-active", type: "property", initialValue: false,
                                                         source: { property: "sensor-state", transform: "($value === \"active\") || ($value === \"fault-active\")" }}, _config);
   this.ensurePropertyExists('fault', 'property', { name: "fault", type: "property", initialValue: false,
                                                         source: { property: "sensor-state", transform: "($value === \"fault\") || ($value === \"fault-active\")" }}, _config);
   this.ensurePropertyExists('tamper', 'property', { name: "tamper", type: "property", initialValue: false,
                                                         source: { property: "sensor-state", transform: "($value === \"tamper\")" }}, _config);
}

util.inherits(HouseAlarmWiredSensor, HouseAlarmSensor);

// Called when current state required
HouseAlarmWiredSensor.prototype.export = function(_exportObj) {
   HouseAlarmSensor.prototype.export.call(this, _exportObj);
};

// Called when current state required
HouseAlarmWiredSensor.prototype.import = function(_importObj) {
   HouseAlarmSensor.prototype.import.call(this, _importObj);
};

HouseAlarmWiredSensor.prototype.coldStart = function() { 
   HouseAlarmSensor.prototype.coldStart.call(this);
};

HouseAlarmWiredSensor.prototype.hotStart = function() {
   HouseAlarmSensor.prototype.hotStart.call(this);
};

module.exports = exports = HouseAlarmWiredSensor;
