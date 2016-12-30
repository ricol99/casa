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
   var that = this;
   this.wire = new ADCPi(this.address1, this.address2, 18);

   startScanning(this);
}

function startScanning(_this) {
   var that = _this;
   that.scanning = true;
   var v = that.wire.readVoltage(that.channel);
   var p = (v - that.inputMin) / that.inputRange;
   that.previousValue = (that.outputRange * p) + that.outputMin;

   that.intervalTimerId = setInterval(function() {
      var voltage = that.wire.readVoltage(that.channel);
      var placeInRange = (voltage - that.inputMin) / that.inputRange;
      var outputVal = (that.outputRange * placeInRange) + that.outputMin;

      if (that.floorOutput) {
         outputVal = Math.floor(outputVal);
      }

      if (outputVal != that.previousValue) {

         var diff = outputVal-that.previousValue;
         diff = Math.abs(diff);
         console.log('Difference is: '+diff);

         if (diff < that.maxChange) {
            console.log('It\'s a small change,it\'s ok!');
            console.log('Reading 1: ' + voltage + 'V = ' + outputVal + '%');
            that.previousValue = outputVal;
            that.updatePropertyAfterRead(outputVal , { sourceName: this.ownerName });
         }
         else {
            console.log('Difference is too large! Ignoring!');
         }
      }
   }, _this.interval*1000);
}

function stopScanning(_this) {
   var that = _this;

   if (that.scanning) {
      clearTimeout(that.intervalTimerId);
   }
}

module.exports = exports = I2CPropertyBinder;
 
