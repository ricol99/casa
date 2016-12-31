var util = require('util');
var PropertyBinder = require('./propertybinder');
var i2c = require('./ABElectronics_NodeJS_Libraries/lib/adcpi/adcpi');

function I2CPropertyBinder(_config, _owner) {

   PropertyBinder.call(this, _config, _owner);

   this.address1 = _config.address1;
   this.address2 = _config.address2;
   this.channel = _config.channel;
   this.interval = (_config.interval != undefined) ? _config.interval : 5;
   this.maxChange = (_config.maxChange != undefined) ? _config.maxChange : 10;

   this.inputMin = (_config.inputMin != undefined) ? _config.inputMin : 0;
   this.inputMax = (_config.inputMax != undefined) ? _config.inputMax : 5;
   this.outputMin = (_config.outputMin != undefined) ? _config.outputMin : 0;
   this.outputMax = (_config.outputMax != undefined) ? _config.outputMax : 100;
   this.floorOutput = _config.floorOutput;

   this.inputRange = this.inputMax - this.inputMin;
   this.outputRange = this.outputMax - this.outputMin;

   this.scanning = false;
}

util.inherits(I2CPropertyBinder, PropertyBinder);

I2CPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   console.log(this.name + ': Attempting to set property ' + this.propertyName + ' to ' + _propValue);
   _callback(false);
}

I2CPropertyBinder.prototype.coldStart = function() {
   this.wire = new ADCPi(this.address1, this.address2, 18);

   startScanning(this);
}

function startScanning(_this) {
   _this.scanning = true;
   var v = _this.wire.readVoltage(_this.channel);
   var p = (v - _this.inputMin) / _this.inputRange;
   _this.previousValue = (_this.outputRange * p) + _this.outputMin;

   if (_this.floorOutput) {
      _this.previousValue = Math.floor(_this.previousValue);
   }

   _this.intervalTimerId = setInterval(function(_that) {
      var voltage = _that.wire.readVoltage(_that.channel);
      var placeInRange = (voltage - _that.inputMin) / _that.inputRange;
      var outputVal = (_that.outputRange * placeInRange) + _that.outputMin;

      if (_that.floorOutput) {
         outputVal = Math.floor(outputVal);
      }

      if (outputVal != _that.previousValue) {

         var diff = outputVal-_that.previousValue;
         diff = Math.abs(diff);
         console.log('Difference is: '+diff);

         if (diff < _that.maxChange) {
            console.log('It\'s a small change,it\'s ok!');
            console.log('Reading 1: ' + voltage + 'V = ' + outputVal + '%');
            _that.previousValue = outputVal;
            _that.updatePropertyAfterRead(outputVal , { sourceName: _that.ownerName });
         }
         else {
            console.log('Difference is too large! Ignoring!');
         }
      }
   }, _this.interval*1000, _this);
}

function stopScanning(_this) {

   if (_this.scanning) {
      clearTimeout(_this.intervalTimerId);
   }
}

module.exports = exports = I2CPropertyBinder;
 
