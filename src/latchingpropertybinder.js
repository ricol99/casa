var util = require('util');
var LogicPropertyBinder = require('./logicpropertybinder');

function LatchingPropertyBinder(_config, _owner) {

   this.minOutputTime = _config.minOutputTime;

   if (_config.controller) {
      _config.targetDefaultTriggerConditions = true;
      _config.ignoreTargetUpdates = false;

      if (typeof _config.controller == "string") {
         _config.target = _config.controller;
      }
      else {
         // Assume object
         _config.target = _config.controller.source;
         _config.targetProperty = _config.controller.sourceProperty;
         _config.targetTriggerCondition = _config.controller.triggerCondition;
         _config.targetTriggerValue = _config.controller.triggerValue;
      }
  }

   LogicPropertyBinder.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.latestInactiveData = { sourceName: this.name };
   var that = this;
   this.cStart = true;
   this.sourceActive = false;
   this.controllerActive = false;
}

util.inherits(LatchingPropertyBinder, LogicPropertyBinder);

LatchingPropertyBinder.prototype.copyData = function(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

LatchingPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {

   if (_propValue) {
      console.log(this.name + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         this.restartTimer();
         this.updatePropertyAfterRead(true, _data);
      }
      else {
         if (this.controllerActive) {
            this.updatePropertyAfterRead(true, _data);
         }
      }
   }
   else {
      console.log(this.name + ': target ' + _data.sourceName + ' inactive!');
      this.sourceActive = false;

      if (this.myPropertyValue()) {

         if (this.minOutputTime != undefined) {
            // Destination is active. If there is no timer, deactivate. Else, let the timer do it
            if (this.minOutputTimeObj == null) {
               this.updatePropertyAfterRead(false, _data);
            }
            else {
               // save data for the timer to use
               this.latestInactiveData = this.copyData(_data);
            }
         }
         else {
            // save data for the timer to use
            this.latestInactiveData = this.copyData(_data);
         }
      }
      else {
         this.updatePropertyAfterRead(false, _data);
      }
   }
   _callback(true);
}

LatchingPropertyBinder.prototype.restartTimer = function() {
   var that = this;

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function() {
      that.minOutputTimeObj = null;

      if (!that.sourceActive) {
         that.updatePropertyAfterRead(false, that.latestInactiveData);
         that.latestInactiveData = { sourceName: this.name };
      }
   }, this.minOutputTime*1000);
}

LatchingPropertyBinder.prototype.sourceIsActive = function(_data) {
   this.setProperty(true, _data, function() {});
}

LatchingPropertyBinder.prototype.sourceIsInactive = function(_data) {
   this.setProperty(false, _data, function() {});
}

LatchingPropertyBinder.prototype.targetIsActive = function(_data) {
   this.controllerActive = true;
}

LatchingPropertyBinder.prototype.targetIsInactive = function(_data) {
   this.controllerActive = false;

   if (this.myPropertyValue()) {
      that.updatePropertyAfterRead(false, that.latestInactiveData);
      that.latestInactiveData = { sourceName: this.name };
   }
}

module.exports = exports = LatchingPropertyBinder;
