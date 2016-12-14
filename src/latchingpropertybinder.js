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
   this.lastSourceListener = null;
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

LatchingPropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   var propValue = _data.propertyValue;
   this.lastSourceListener = _sourceListener;
   this.lastCallback = _callback;

   console.log("CCCCCCC ", _data);

   if (propValue) {
      console.log(this.name + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         this.restartTimer();
         this.active = true;
         return _callback(null, propValue);
      }
      else if (this.controllerActive) {
         this.active = true;
         return _callback(null, propValue);
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
               return _callback(null, false);
            }
         }
      }
      else {
         this.active = false;
         return _callback(null, false);
      }
   }
}

LatchingPropertyBinder.prototype.restartTimer = function() {
   var that = this;

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function() {
      that.minOutputTimeObj = null;

      if (!that.sourceActive) {
         that.active = false;

         if (that.lastCallback) {
            that.lastCallback(null, false);
            that.lastCallback = null;
            return;
         }
      }
   }, this.minOutputTime*1000);
}

LatchingPropertyBinder.prototype.processTargetPropertyChange = function(_targetListener, _data) {
   console.log("HHHHHH ", _data);

   this.controllerActive = _data.propertyValue;

   if (this.controllerActive) {
      if (!this.active && this.sourceActive) {

         if (this.lastCallback) {
            this.active = true;
            this.lastCallback(null, true);
            this.lastCallback = null;
            return;
         }
      }
   }
   else {
      if (this.active) {

         if (this.lastCallback) {
            this.active = false;
            this.lastCallback(null, false);
            this.lastCallback = null;
            return;
         }
      }
   }
}
   
module.exports = exports = LatchingPropertyBinder;
