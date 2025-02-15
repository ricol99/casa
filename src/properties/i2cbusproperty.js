var util = require('util');
var Property = require('../property');
const I2c = require('i2c-bus');

// Config
// bus - i2c bus - default 0
// address - i2c address
// channel - i2c channel
// period - i2c read period in seconds - default 0.5
// precision - reading precision - top update only when a change larger than state precision (1000, 100, 10, 1) -> (1/1000, 1/100, 1/10, 1) - default = 10

function I2cBusProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.bus = _config.hasOwnProperty("bus") ? _config.bus : 0;
   this.address = _config.address;
   this.channel = _config.channel;
   this.period = _config.hasOwnProperty("period") ? _config.period : 0.5;
   this.precision = _config.hasOwnProperty("precision") ? _config.precision : 10;
}

util.inherits(I2cBusProperty, Property);

// Called when system state is required
I2cBusProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
I2cBusProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
I2cBusProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
   this.start();
};

// Called to start a cold system
I2cBusProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
   this.start();
};

I2cBusProperty.prototype.start = function () {

   this.i2cChannel = I2c.open(this.bus, _err => {

      if (_err) {
         console.error(this.uName + ": start() Unable to open I2C Bus " + this.bus);
         return;
      }

      this.readBus();
   });
};

I2cBusProperty.prototype.readBus = function() {
   this.readTimeStamp = Date.now();

   this.i2cChannel.readWord(this.address, this.channel, (_err, _rawData) => {

      if (_err) {
         console.error(this.uName + ": start() Unable to read I2C Bus " + this.bus + ", channel " + this.channel);
         return;
      }

      this.processRawData(_rawData);
      var nextReadInterval = (this.period * 1000) - (Date.now() - this.readTimeStamp);

      if (nextReadInterval < 0) {
         nextReadInterval = this.period * 1000;
      }

      this.timeout = util.setTimeout( () => {
         this.readBus();
      }, nextReadInterval);
   });
};

I2cBusProperty.prototype.processRawData = function(_rawData) {
   this.updatePropertyInternal(_rawData / this.precision);
};

module.exports = exports = I2cBusProperty;
