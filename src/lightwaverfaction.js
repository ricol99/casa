var util = require('util');
var Action = require('./action');
var LightwaveRF = require("lightwaverf");

function LightwaveRfAction(_config) {

   this.roomId = _config.roomId;
   this.deviceId = _config.deviceId;
   this.dimLevel = (_config.dimLevel) ? _config.dimLevel : null;

   Action.call(this, _config);

   var that = this;

   this.on('activated', function (_data) {
      console.log(that.name + ': received activated event');

      if ((_data.applyProps && _data.applyProps.dimLevel) || that.dimLevel) {
         var chosenDimLevel = (_data.applyProps && _data.applyProps.dimLevel) ? _data.applyProps.dimLevel : that.dimLevel;

         that.target.setDeviceDim(that.roomId, that.deviceId, chosenDimLevel, function(_error, _content) {

            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
      else {
         that.target.turnDeviceOn(that.roomId, that.deviceId, function(_error, _content) {

            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
   });

   this.on('deactivated', function (_data) {
      console.log(that.name + ': received deactivated event');

      if (_data.applyProps && _data.applyProps.dimLevel) {

         that.target.setDeviceDim(that.roomId, that.deviceId, _data.applyProps.dimLevel, function(_error, _content) {

            if (_error) {
               console.log(that.name + ': Error turning room off ' + _error.message);
            } else {
               console.log(that.name + ': Response: ' + _content);
            }
         });
      }
      else {
         that.target.turnDeviceOff(that.roomId, that.deviceId, function(_error, _content) {

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

