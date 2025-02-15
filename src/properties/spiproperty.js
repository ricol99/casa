var util = require('util');
var Property = require('../property');
const Mcpadc = require('mcp-spi-adc');

// Config
// mcpDevice = Device number - default 3008
// device - spi device
// channel - spi channel
// period - spi read period in seconds - default 0.5
// vdd - supply voltage - default 3.3
// precisionDivider - reading precision Divider - top update only when a change larger than state precision (1000, 100, 10, 1) -> (1/1000, 1/100, 1/10, 1) - default = 1
// prceisionDelta - reading precision delta allowed before update

function SpiProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.device = _config.device;
   this.channel = _config.channel;
   this.period = _config.hasOwnProperty("period") ? _config.period : 0.5;
   this.vdd = _config.hasOwnProperty("vdd") ? _config.vdd : 3.3;
   this.precisionDivider = _config.hasOwnProperty("precisionDivider") ? _config.precisionDivider : 1;
   this.precisionDelta = _config.hasOwnProperty("precisionDelta") ? _config.precisionDelta : 0.02;
   var busSpeedMap = { 3002: 1200000, 3004: 1350000, 3008: 1350000, 3202: 900000, 3204: 1000000, 3208: 500000 };
   this.busSpeed = busSpeedMap[_config.hasOwnProperty("mcpDevice") ? _config.mcpDevice : 3008];
}

util.inherits(SpiProperty, Property);

// Called when system state is required
SpiProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
SpiProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
SpiProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
   this.start();
};

// Called to start a cold system
SpiProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
   this.start();
};

SpiProperty.prototype.start = function () {

   this.spiChannel = Mcpadc.open(this.channel, { deviceNumber: this.device, speedHz: this.busSpeed }, (_err) => {

      if (_err) {
         console.error(this.uName + ": start() Unable to open SPI device " + this.device);
         return;
      }

      this.readBus();
   });
};

SpiProperty.prototype.readBus = function() {
   this.readTimeStamp = Date.now();

   this.spiChannel.read((_err, _reading) => {

      if (_err) {
         console.error(this.uName + ": start() Unable to read SPI device " + this.device + ", channel " + this.channel);
         return;
      }

      this.processRawData(_reading.value);
      var nextReadInterval = (this.period * 1000) - (Date.now() - this.readTimeStamp);

      if (nextReadInterval < 0) {
         nextReadInterval = 1;
      }

      this.timeout = util.setTimeout( () => {
         this.readBus();
      }, nextReadInterval);
   });
};

SpiProperty.prototype.processRawData = function(_rawData) {
   var newValue = (_rawData * this.vdd) / this.precisionDivider;
   var delta = Math.abs(newValue - this.value);

   if (this.cold || (delta > this.precisionDelta)) {
      this.updatePropertyInternal(newValue);
   }
};

module.exports = exports = SpiProperty;
