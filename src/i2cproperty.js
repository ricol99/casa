var util = require('util');
var Property = require('./property');
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

I2CProperty.prototype.setProperty = function(_propValue, _data) {
   console.log(this.uName + ': Not allowed to set property ' + this.name + ' to ' + _propValue);
   return false;
}

I2CProperty.prototype.coldStart = function() {
   this.wire = new ADCPi(this.address1, this.address2, 18);
   startScanning(this);
}

// ====================
// NON_EXPORTED METHODS
// ====================

function trimInputReading(_this, _inputReading) {

   if (_this.transforming) {

      if (_this.inputMax > this.inputMin) {
         return (_inputReading > _this.inputMax) ? _this.inputMax : (_inputReading < _this.inputMin) ? _this.inputMin : _inputReading;
      }
      else {
         return (_inputReading < _this.inputMax) ? _this.inputMax : (_inputReading > _this.inputMin) ? _this.inputMin : _inputReading;
      }
   }
   else {
      return _inputReading;
   }
}

function inputResolutionThresholdExceeded(_this, _inputReading) {

   if (_this.inputDeltaMinimum != undefined) {
      return (Math.abs(_this.previousInputReading - _inputReading) > _this.inputDeltaMinimum);
   }
   else {
      return (_inputReading != _this.previousInputReading);
   }
}

function transformInputReading(_this, _inputReading) {
   var outputReading = _inputReading;

   if (_this.transforming) {
      var placeInRange = (_inputReading - _this.inputMin) / _this.inputRange;
      var outputReading = (_this.outputRange * placeInRange) + _this.outputMin;
   }

   if (_this.floorOutput) {
      outputReading = Math.floor(outputReading);
   }

   return outputReading;
}

function publishNewPropertyValue(_this, _inputReading, _propertyValue) {
   console.log(_this.uName + ': Input Reading: ' + _inputReading + 'V, property value: ' + _propertyValue);
   _this.previousInputReading = _inputReading;
   _this.previousOutputValue = _propertyValue;
   _this.updatePropertyInternal(_propertyValue);
}

function startScanning(_this) {
   _this.scanning = true;
   var input  = trimInputReading(_this, _this.wire.readVoltage(_this.channel));
   var out = transformInputReading(_this, input);
   publishNewPropertyValue(_this, input, out);

   _this.intervalTimerId = setInterval(function(_that) {
      var inputReading = trimInputReading(_that, _that.wire.readVoltage(_that.channel));

      if (inputResolutionThresholdExceeded(_that, inputReading)) {
         var outputValue = transformInputReading(_that, inputReading);
         var outputDifference = Math.abs(outputValue - _that.previousOutputValue);
         console.log('Output difference is: ' + outputDifference);

         if (_that.maxChange != undefined) {

            if (outputDifference < _that.maxChange) {
               console.log('It\'s a small change, it\'s ok!');
               publishNewPropertyValue(_that, inputReading, outputValue);
            }
            else if (_that.maxIgnore != undefined && ((_that.ignoreCounter + 1) < _that.maxIgnore)) {
                _that.ignoreCounter += 1;
               console.log('Output difference is too large! Ignoring! Ignored ' + _that.ignoreCounter + ' times...');
            }
            else {
               _that.ignoreCounter = 0;
               console.log(_that.uName + ': Ignored reading for too many intervals, accepting new value');
               publishNewPropertyValue(_that, inputReading, outputValue);
            }
         }
         else {
            publishNewPropertyValue(_that, inputReading, outputValue);
         }
      }
   }, _this.interval*1000, _this);
}

function stopScanning(_this) {

   if (_this.scanning) {
      clearTimeout(_this.intervalTimerId);
   }
}

module.exports = exports = I2CProperty;
 