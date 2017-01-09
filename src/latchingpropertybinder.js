var util = require('util');
var PropertyBinder = require('./propertybinder');

function LatchingPropertyBinder(_config, _owner) {

   this.minOutputTime = _config.minOutputTime;

   if (_config.controller) {
      _config.ignoreTargetUpdates = false;
      _config.target = _config.controller.source;
      _config.targetProperty = _config.controller.sourceProperty;
      _config.inputTransform = _config.controller.inputTransform;
      _config.inputMap = _config.controller.inputMap;
  }

   PropertyBinder.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.sourceActive = false;
   this.controllerActive = false;
   this.active = false;
   this.lastData = null;
}

util.inherits(LatchingPropertyBinder, PropertyBinder);

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

LatchingPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.propertyValue;
   this.lastData = _data;

   if (propValue) {
      console.log(this.name + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         this.restartTimer();
         this.active = true;
         this.updatePropertyAfterRead(propValue, _data);
         return;
      }
      else if (this.controllerActive) {
         this.active = true;
         this.updatePropertyAfterRead(propValue, _data);
         return;
      }
   }
   else {
      console.log(this.name + ': target ' + _data.sourceName + ' inactive!');
      this.sourceActive = false;

      if (this.active) {

         if (this.minOutputTime != undefined) {

            // Destination is active. If there is no timer, deactivate. Else, let the timer do it
            if (this.minOutputTimeObj == null) {
               this.active = false;
               this.updatePropertyAfterRead(false, _data);
               return;
            }
         }
      }
      else {
         this.active = false;
         this.updatePropertyAfterRead(false, _data);
         return;
      }
   }
}

LatchingPropertyBinder.prototype.restartTimer = function() {

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function(_this) {
      _this.minOutputTimeObj = null;

      if (!_this.sourceActive) {
         _this.active = false;

         if (_this.lastData) {
            _this.updatePropertyAfterRead(false, _this.lastData);
            _this.lastData = null;
            return;
         }
      }
   }, this.minOutputTime*1000, this);
}

LatchingPropertyBinder.prototype.newPropertyValueReceivedFromTarget = function(_targetListener, _data) {
   this.controllerActive = _data.propertyValue;

   if (this.controllerActive) {
      if (!this.active && this.sourceActive) {

         if (this.lastData) {
            this.active = true;
            this.updatePropertyAfterRead(true, this.lastData);
            this.lastData = null;
            return;
         }
      }
   }
   else {
      if (this.active) {

         if (this.lastData) {
            this.active = false;
            this.updatePropertyAfterRead(false, this.lastData);
            this.lastData = null;
            return;
         }
      }
   }
}
   
module.exports = exports = LatchingPropertyBinder;
