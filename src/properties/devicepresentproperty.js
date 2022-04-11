var util = require('util');
var Property = require('../property');
var ping = require('ping');

function DevicePresentProperty(_config, _owner) {

   this.host = _config.host;
   this.interval = (_config.interval == undefined) ? 60 : _config.interval;

   Property.call(this, _config, _owner);
}

util.inherits(DevicePresentProperty, Property);

// Called when system state is required
DevicePresentProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
   _exportObj.timeoutObj = this.timeoutObj ? this.timeoutObj.left() : -1;
};

// Called to restore system state before hot start
DevicePresentProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj)) {
   this.timeoutObj = _importObj.timeoutObj;
};

// Called after system state has been restored
DevicePresentProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);

   if (this.timeoutObj !== -1) {
      this.restartTimer(_importObj.timeoutObj);
   }
};

DevicePresentProperty.prototype.coldStart = function(_event) {
   this.restartTimer();
}

// ====================
// NON-EXPORTED METHODS
// ====================

DevicePresentProperty.prototype.restartTimer = function(_overrideTimeout) {
   var timeout  = _overrideTimeout ? _overrideTimeout : this.interval * 1000;

   if (!_overrideTimeout && this.timeoutObj) {
      util.clearTimeout(this.timeoutObj);
   }

   this.timeoutObj = util.setTimeout( () => {
      this.timeoutObj = null;

      if (this.valid) {

         ping.sys.probe(this.host, (_isAlive) => {
            this.updatePropertyInternal(_isAlive);
            this.restartTimer();
         });
      }
   }, timeout);
}

module.exports = exports = DevicePresentProperty;
