var util = require('util');
var PropertyBinder = require('./propertybinder');

function LogicPropertyBinder(_config, _owner) {
   _config.defaultTriggerConditions = true;

   PropertyBinder.call(this, _config, _owner);

   this.applyProps = {};
   this.applyProps.active = (_config.applyProps) ? ((_config.applyProps.active) ? _config.applyProps.active : null) : null;
   this.applyProps.inactive = (_config.applyProps) ? ((_config.applyProps.inactive) ? _config.applyProps.inactive : null) : null;
   this.outputActiveValue = _config.outputActiveValue;
   this.outputInactiveValue = _config.outputInactiveValue;

   var that = this;
}

util.inherits(LogicPropertyBinder, PropertyBinder);

LogicPropertyBinder.prototype.copyData = function(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

LogicPropertyBinder.prototype.mergeApplyProps = function(_sourceData, _applyProps) {
   var dataToSend = this.copyData(_sourceData);

   if (dataToSend) {

      if (_applyProps) {

         if (!dataToSend.applyProps) { dataToSend.applyProps = {}; }
         for (var attrname in _applyProps) { dataToSend.applyProps[attrname] = _applyProps[attrname]; }
      }
   }
   else {
      dataToSend.applyProps = _applyProps;
   }
   return dataToSend;
}

LogicPropertyBinder.prototype.goActive = function(_sourceData, _outputValue) {
   console.log(this.name + ": Going active! Previously active state=" + this.myPropertyValue());

   var sendData = this.mergeApplyProps(_sourceData, this.applyProps.active);
   sendData.sourceName = this.name;
   sendData.oldState = this.myPropertyValue();;
   console.log(this.name+": Data=", sendData);

   var outputValue = (_outputValue != undefined) ? _outputValue : ((this.outputActiveValue == undefined) ? true : this.outputActiveValue);
   this.updatePropertyAfterRead(outputValue, sendData);
}

LogicPropertyBinder.prototype.goInactive = function(_sourceData, _outputValue) {
   console.log(this.name + ": Going inactive! Previously active state=" + this.myPropertyValue());

   var sendData = this.mergeApplyProps(_sourceData, this.applyProps.inactive);
   sendData.sourceName = this.name;
   sendData.oldState = this.myPropertyValue();;
   console.log(this.name+": Data=", sendData);

   var outputValue = (_outputValue != undefined) ? _outputValue : ((this.outputInactiveValue == undefined) ? false : this.outputInactiveValue);
   this.updatePropertyAfterRead(outputValue, sendData);
}

// Override these methods
LogicPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   this.updatePropertyAfterRead(_propValue, _data);
   _callback(true);
}

LogicPropertyBinder.prototype.sourceIsActive = function(_data) {
   this.goActive(_data);
}

LogicPropertyBinder.prototype.sourceIsInactive = function(_data) {
   this.goInactive(_data);
}

// Do not override this
LogicPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   // DO NOTHING
}

module.exports = exports = LogicPropertyBinder;
