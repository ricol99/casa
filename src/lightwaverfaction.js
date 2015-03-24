var util = require('util');
var Action = require('./action');
var LightwaveRF = require("lightwaverf");

function LightwaveRfAction(_config) {

   this.roomId = _config.roomId;
   this.deviceId = (_config.deviceId) ? _config.deviceId : null;
   this.dimLevel = (_config.dimLevel) ? _config.dimLevel : null;

   Action.call(this, _config);

   this.lightwaveRf = new LightwaveRF({ ip: this.target.getProperty('ipAddress') });

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.deviceId) {
         that.lightwaveRf.turnRoomOn(that.roomId, function(_error, _content) {
            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
      else if (that.dimLevel) {
         that.lightwaveRf.setDeviceDim(that.roomId, that.deviceId, that.dimLevel, function(_error, _content) {
            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
      else {
         that.lightwaveRf.turnDeviceOn(that.roomId, that.deviceId, function(_error, _content) {
            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      if (!that.deviceId) {
         that.lightwaveRf.turnRoomOff(that.roomId, function(_error, _content) {
            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
      else {
         that.lightwaveRf.turnDeviceOff(that.roomId, that.deviceId, function(_error, _content) {
            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
   });
}

util.inherits(LightwaveRfAction, Action);

module.exports = exports = LightwaveRfAction;

