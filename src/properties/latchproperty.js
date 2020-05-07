var util = require('../util');
var Property = require('../property');

function LatchProperty(_config, _owner) {

   this.minOutputTime = _config.minOutputTime;

   if (_config.controller) {
      _config.ignoreTargetUpdates = false;
      _config.target = _config.controller.fullName;
      _config.targetProperty = _config.controller.property;
      _config.transform = _config.controller.transform;
      _config.transformMap = _config.controller.transformMap;
  }

   Property.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.sourceActive = false;
   this.controllerActive = false;
   this.active = false;
   this.lastData = null;
}

util.inherits(LatchProperty, Property);

LatchProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.value;
   this.lastData = _data;

   if (propValue) {
      console.log(this.fullName + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         this.restartTimer();
         this.active = true;
         this.updatePropertyInternal(propValue, _data);
         return;
      }
      else if (this.controllerActive) {
         this.active = true;
         this.updatePropertyInternal(propValue, _data);
         return;
      }
   }
   else {
      console.log(this.fullName + ': target ' + _data.sourceName + ' inactive!');
      this.sourceActive = false;

      if (this.active) {

         if (this.minOutputTime != undefined) {

            // Destination is active. If there is no timer, deactivate. Else, let the timer do it
            if (this.minOutputTimeObj == null) {
               this.active = false;
               this.updatePropertyInternal(false, _data);
               return;
            }
         }
      }
      else {
         this.active = false;
         this.updatePropertyInternal(false, _data);
         return;
      }
   }
}

LatchProperty.prototype.newPropertyValueReceivedFromTarget = function(_targetListener, _data) {
   this.controllerActive = _data.value;

   if (this.controllerActive) {
      if (!this.active && this.sourceActive) {

         if (this.lastData) {
            this.active = true;
            this.updatePropertyInternal(true, this.lastData);
            this.lastData = null;
            return;
         }
      }
   }
   else {
      if (this.active) {

         if (this.lastData) {
            this.active = false;
            this.updatePropertyInternal(false, this.lastData);
            this.lastData = null;
            return;
         }
      }
   }
}
   
// ====================
// NON_EXPORTED METHODS
// ====================

LatchProperty.prototype.restartTimer = function() {

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function(_this) {
      _this.minOutputTimeObj = null;

      if (!_this.sourceActive) {
         _this.active = false;

         if (_this.lastData) {
            _this.updatePropertyInternal(false, _this.lastData);
            _this.lastData = null;
            return;
         }
      }
   }, this.minOutputTime*1000, this);
}

module.exports = exports = LatchProperty;
