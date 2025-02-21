var util = require('util');
var HouseAlarmSensor = require('./housealarmsensor');

// Config
// mainEolResistance - Main EOL resistance
// activeEolResistance - Active EOL resistance
// faultEolResistance - Fault EOL resistance
// dividerResistance - Resistance of voltage divider resistor
// supplyVoltage - Voltage across sensor
// resistorTolerance - tolerance (in %)
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
   var tolerance = _config.hasOwnProperty("resistorTolerance") ? _config.resistorTolerance / 100.0 : 0.05;

   var mainEolResistanceMin = _config.mainEolResistance * (1-tolerance);
   var activeEolResistanceMin = _config.activeEolResistance * (1-tolerance);
   var dividerResistanceMin = _config.dividerResistance * (1-tolerance);

   var mainEolResistanceMax = _config.mainEolResistance * (1+tolerance);
   var activeEolResistanceMax = _config.activeEolResistance * (1+tolerance);
   var dividerResistanceMax = _config.dividerResistance * (1+tolerance);

   this.minimumVoltages = { tamper: 0,
                            inactive: (mainEolResistanceMin / (dividerResistanceMax + mainEolResistanceMin)) * _config.supplyVoltage,
                            active: ((mainEolResistanceMin + activeEolResistanceMin) / (dividerResistanceMax + mainEolResistanceMin + activeEolResistanceMin)) * _config.supplyVoltage };

   if (_config.hasOwnProperty("faultEolResistance")) {
      var faultEolResistanceMin = _config.faultEolResistance * (1-tolerance);

      this.minimumVoltages["fault"] = ((mainEolResistanceMin + faultEolResistanceMin ) / (dividerResistanceMax + mainEolResistanceMin + faultEolResistanceMin)) * _config.supplyVoltage;

      this.minimumVoltages["fault-active"] = ((mainEolResistanceMin + activeEolResistanceMin + faultEolResistanceMin ) /
                                              (dividerResistanceMax + mainEolResistanceMin +activeEolResistanceMin + faultEolResistanceMin)) * _config.supplyVoltage;
   }

   var maximumVoltages = { inactive: (mainEolResistanceMax / (dividerResistanceMin + mainEolResistanceMax)) * _config.supplyVoltage,
                           active: ((mainEolResistanceMax + activeEolResistanceMax) / (dividerResistanceMin + mainEolResistanceMax + activeEolResistanceMax)) * _config.supplyVoltage };


   if (_config.hasOwnProperty("faultEolResistance")) {
      var faultEolResistanceMax = _config.faultEolResistance * (1+tolerance);

      maximumVoltages["fault"] = ((mainEolResistanceMax + faultEolResistanceMax) / (dividerResistanceMin + mainEolResistanceMax + faultEolResistanceMax)) * _config.supplyVoltage;
      maximumVoltages["fault-active"] = ((mainEolResistanceMax + activeEolResistanceMax + faultEolResistanceMax) /
                                         (dividerResistanceMin + mainEolResistanceMax + activeEolResistanceMax + faultEolResistanceMax)) * _config.supplyVoltage;
   }

   this.minimumVoltages["tamper-high"] =  _config.supplyVoltage * 0.9

   var testVoltages = [];
   var faultyDevice = false;

   testVoltages.push(this.minimumVoltages["inactive"]);
   testVoltages.push(maximumVoltages["inactive"]);

   if (_config.hasOwnProperty("faultEolResistance")) {
      testVoltages.push(this.minimumVoltages["fault"]);
      testVoltages.push(maximumVoltages["fault"]);
   }

   testVoltages.push(this.minimumVoltages["active"]);
   testVoltages.push(maximumVoltages["active"]);

   if (_config.hasOwnProperty("faultEolResistance")) {
      testVoltages.push(this.minimumVoltages["fault-active"]);
      testVoltages.push(maximumVoltages["fault-active"]);
   }

   for (var i = 1; i < testVoltages.length-2; i+=2) {

      if (testVoltages[i] > testVoltages[i+1]) {
         console.error(this.uName + ": Overlapping voltages - device is in fault status");
         faultyDevice = true;
      }
   }

   this.ensurePropertyExists('sensor-state', 'quantiseproperty',
                             { quanta: this.minimumVoltages, bufferTimers: { tamper: 2, fault: 2, "fault-acitve": 2, "tamper-high": 2 }, source: { property: "sensor-voltage"} }, _config);

   this.ensurePropertyExists('raw-active', 'property', { name: "raw-active", type: "property", initialValue: false,
                                                         source: { property: "sensor-state", transform: "($value === \"active\") || ($value === \"fault-active\")" }}, _config);

   if (faultyDevice) {
      this.ensurePropertyExists('fault', 'property', { name: "fault", type: "property", initialValue: true }, _config);
   }
   else {
      this.ensurePropertyExists('fault', 'property', { name: "fault", type: "property", initialValue: false,
                                                       source: { property: "sensor-state", transform: "($value === \"fault\") || ($value === \"fault-active\")" }}, _config);
   }

   this.ensurePropertyExists('tamper', 'property', { name: "tamper", type: "property", initialValue: false,
                                                     source: { property: "sensor-state", transform: "($value === \"tamper\") || ($value === \"tamper-high\")" }}, _config);
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
