var util = require('util');
var Property = require('../property');
var i2c = require('./ABElectronics_NodeJS_Libraries/lib/adcpi/adcpi');

// I2C Device
function I2CProperty(_config, _owner) {

   Property.call(this, _config, _owner);

   this.writable = false;
   this.address1 = _config.address1;
   this.address2 = _config.address2;
   this.channel = _config.channel;
   this.interval = (_config.interval != undefined) ? _config.interval : 5;
   this.maxChange = _config.maxChange;
   this.maxIgnore = _config.maxIgnore;

   this.transforming = _config.inputMin != undefined;
   this.outputResolution = _config.outputResolution;
   this.inputDeltaMinimum = _config.inputDeltaMinimum;
   this.floorOutput = _config.floorOutput;

   if (this.transforming) {
      this.inputMin = _config.inputMin;
      this.inputMax = _config.inputMax;
      this.outputMin = (_config.outputMin != undefined) ? _config.outputMin : 0;
      this.outputMax = (_config.outputMax != undefined) ? _config.outputMax : 100;

      this.inputRange = this.inputMax - this.inputMin;
      this.outputRange = this.outputMax - this.outputMin;

      if (this.outputResolution != undefined) {
         this.inputDeltaMinimum = Math.abs(this.inputRange / this.outputResolution);
         console.log('***************** Input Delta Minimum: ' + this.inputDeltaMinimum + ' Output Res: ' + this.outputResolution);
      }
   }

   this.scanning = false;
   this.ignoreCounter = 0;
}

util.inherits(I2CProperty, Property);

I2CProperty.prototype.set = function(_propValue, _data) {
   console.log(this.fullName + ': Not allowed to set property ' + this.name + ' to ' + _propValue);
   return false;
}

I2CProperty.prototype.coldStart = function() {
   this.wire = new ADCPi(this.address1, this.address2, 18);
   this.startScanning();

   Property.prototype.coldStart.call(this);
}

// ====================
// NON_EXPORTED METHODS
// ====================

I2CProperty.prototype.trimInputReading = function(_inputReading) {

   if (this.transforming) {

      if (this.inputMax > this.inputMin) {
         return (_inputReading > this.inputMax) ? this.inputMax : (_inputReading < this.inputMin) ? this.inputMin : _inputReading;
      }
      else {
         return (_inputReading < this.inputMax) ? this.inputMax : (_inputReading > this.inputMin) ? this.inputMin : _inputReading;
      }
   }
   else {
      return _inputReading;
   }
}

I2CProperty.prototype.inputResolutionThresholdExceeded = function(_inputReading) {

   if (this.inputDeltaMinimum != undefined) {
      return (Math.abs(this.previousInputReading - _inputReading) > this.inputDeltaMinimum);
   }
   else {
      return (_inputReading != this.previousInputReading);
   }
}

I2CProperty.prototype.transformInputReading = function(_inputReading) {
   var outputReading = _inputReading;

   if (this.transforming) {
      var placeInRange = (_inputReading - this.inputMin) / this.inputRange;
      var outputReading = (this.outputRange * placeInRange) + this.outputMin;
   }

   if (this.floorOutput) {
      outputReading = Math.floor(outputReading);
   }

   return outputReading;
}

I2CProperty.prototype.publishNewPropertyValue = function(_inputReading, _propertyValue) {
   console.log(this.fullName + ': Input Reading: ' + _inputReading + 'V, property value: ' + _propertyValue);
   this.previousInputReading = _inputReading;
   this.previousOutputValue = _propertyValue;
   this.updatePropertyInternal(_propertyValue);
}

I2CProperty.prototype.startScanning = function() {
   this.scanning = true;
   var input  = this.trimInputReading(this.wire.readVoltage(this.channel));
   var out = this.transformInputReading(input);
   this.publishNewPropertyValue(input, out);

   this.intervalTimerId = setInterval(function(_this) {
      var inputReading = _this.trimInputReading(_this.wire.readVoltage(_this.channel));

      if (_this.inputResolutionThresholdExceeded(inputReading)) {
         var outputValue = _this.transformInputReading(inputReading);
         var outputDifference = Math.abs(outputValue - _this.previousOutputValue);
         console.log('Output difference is: ' + outputDifference);

         if (_this.maxChange != undefined) {

            if (outputDifference < _this.maxChange) {
               console.log('It\'s a small change, it\'s ok!');
               _this.publishNewPropertyValue(inputReading, outputValue);
            }
            else if (_this.maxIgnore != undefined && ((_this.ignoreCounter + 1) < _this.maxIgnore)) {
                _this.ignoreCounter += 1;
               console.log('Output difference is too large! Ignoring! Ignored ' + _this.ignoreCounter + ' times...');
            }
            else {
               _this.ignoreCounter = 0;
               console.log(_this.fullName + ': Ignored reading for too many intervals, accepting new value');
               _this.publishNewPropertyValue(inputReading, outputValue);
            }
         }
         else {
            _this.publishNewPropertyValue(inputReading, outputValue);
         }
      }
   }, this.interval*1000, this);
}

I2CProperty.prototype.stopScanning = function() {

   if (this.scanning) {
      clearTimeout(this.intervalTimerId);
   }
}

module.exports = exports = I2CProperty;
 
