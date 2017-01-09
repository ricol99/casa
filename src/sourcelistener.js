var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function SourceListener(_config, _owner) {
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.owner = _owner;
   this.sourceName = _config.source;

   this.inputTransform = _config.inputTransform; 
   this.inputMap = (_config.inputMap) ? copyData(_config.inputMap) : undefined;

   this.ignoreSourceUpdates = (_config.ignoreSourceUpdates == undefined) ? false : _config.ignoreSourceUpdates;
   this.isTarget = (_config.isTarget == undefined) ? false : _config.isTarget;
   this.priority = (_config.priority == undefined) ? 0 : _config.priority;
   this.outputValues = (_config.outputValues == undefined) ? {} : copyData(_config.outputValues);
   this.property = _config.sourceProperty;

   this.sourcePropertyName = this.sourceName + ":" + this.property;

   this.name = "sourcelistener:" + _owner.name + ":" + _config.source + ":" + this.property;

   this.sourceListenerEnabled = false;

   if (this.establishListeners()) {
      this.owner.sourceIsValid({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property });
   }

   this.casa.addSourceListener(this);

   var that = this;
}

SourceListener.prototype.establishListeners = function() {
   var that = this;

   this.propertyChangedCallback = function(_data) {
      that.internalSourcePropertyChanged(_data);
   };

   this.invalidCallback = function(_data) {
      that.internalSourceIsInvalid(_data);
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceListenerEnabled = (this.source) ? true : false;


   if (this.sourceListenerEnabled) {
      this.source.on('property-changed', this.propertyChangedCallback);
      this.source.on('invalid', this.invalidCallback);
   }

   return this.sourceListenerEnabled;
}

SourceListener.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceListenerEnabled)  {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed source listener. result=' + ret);

      if (ret) {
         this.owner.sourceIsValid({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property });
      }
   }
   return ret;
}

SourceListener.prototype.internalSourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   if (this.sourceListenerEnabled) {
      this.sourceListenerEnabled = false;

      this.source.removeListener('property-changed', this.propertyChangedCallback);
      this.source.removeListener('invalid', this.invalidCallback);

      this.owner.sourceIsInvalid({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property });
   }
}

function transformInput(_this, _data) {
   var input = _data.propertyValue;
   var newInput = input;

   if (_this.inputTransform) {
      var exp = _this.inputTransform.replace(/\$value/g, "input");
      newInput = eval(exp);
   }

   if (_this.inputMap && _this.inputMap[newInput] != undefined) {
      newInput = _this.inputMap[newInput];
   }

   return newInput;
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

SourceListener.prototype.getPropertyValue = function() {
   return this.sourcePropertyValue;
}

SourceListener.prototype.internalSourcePropertyChanged = function(_data) {

   if (!this.ignoreSourceUpdates && _data.propertyName == this.property) {
      console.log(this.name + ": processing source property change, property=" + _data.propertyName);

      // ** TODO Do we need to cache data based on the propertyValue? Not done so far
      this.lastData = copyData(_data);
      this.lastData.sourcePropertyName = this.sourcePropertyName;

      console.log("EEEEE", this.lastData);

      if (this.inputTransform || this.inputMap) {
         this.lastData.propertyValue = transformInput(this, _data);
      }

      this.sourcePropertyValue = this.lastData.propertyValue;

      if (this.isTarget) {
         this.owner.targetPropertyChanged(copyData(this.lastData));
      }
      else {
         this.owner.sourcePropertyChanged(copyData(this.lastData));
      }
   }
}

module.exports = exports = SourceListener;
 
