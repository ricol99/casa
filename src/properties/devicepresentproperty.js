var util = require('util');
var Property = require('../property');
var ping = require('ping');

function DevicePresentProperty(_config, _owner) {

   this.host = _config.host;
   this.interval = (_config.interval == undefined) ? 60 : _config.interval;

   Property.call(this, _config, _owner);
}

util.inherits(DevicePresentProperty, Property);

DevicePresentProperty.prototype.coldStart = function(_event) {
   this.restartTimer();
}

// ====================
// NON-EXPORTED METHODS
// ====================

DevicePresentProperty.prototype.restartTimer = function() {

   if (this.timeoutObj) {
      clearTimeout(this.timeoutObj);
   }

   this.timeoutObj = setTimeout( () => {
      this.timeoutObj = null;

      if (this.valid) {

         ping.sys.probe(this.host, (_isAlive) => {
            this.updatePropertyInternal(_isAlive);
            this.restartTimer();
         });
      }
   }, this.interval * 1000);
}

module.exports = exports = DevicePresentProperty;
