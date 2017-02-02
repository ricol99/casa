var util = require('util');
var Property = require('./property');

function LatchProperty(_config, _owner) {

   this.minOutputTime = _config.minOutputTime;

   if (_config.controller) {
      _config.ignoreTargetUpdates = false;
      _config.target = _config.controller.source;
      _config.targetProperty = _config.controller.sourceProperty;
      _config.inputTransform = _config.controller.inputTransform;
      _config.inputMap = _config.controller.inputMap;
  }

   Property.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.sourceActive = false;
   this.controllerActive = false;
   this.active = false;
   this.lastData = null;
}

util.inherits(LatchProperty, Property);

LatchProperty.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.propertyValue;
   this.lastData = _data;

   if (propValue) {
      console.log(this.uName + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         restartTimer(this);
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
      console.log(this.uName + ': target ' + _data.sourceName + ' inactive!');
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
   this.controllerActive = _data.propertyValue;

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

function restartTimer(_this) {

   if (_this.minOutputTimeObj) {
      clearTimeout(_this.minOutputTimeObj);
   }

   _this.minOutputTimeObj = setTimeout(function(_that) {
      _that.minOutputTimeObj = null;

      if (!_that.sourceActive) {
         _that.active = false;

         if (_that.lastData) {
            _that.updatePropertyInternal(false, _that.lastData);
            _that.lastData = null;
            return;
         }
      }
   }, _this.minOutputTime*1000, _this);
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

module.exports = exports = LatchProperty;
