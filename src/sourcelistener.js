var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function SourceListener(_config, _owner) {
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.owner = _owner;
   this.sourceName = _config.uName;

   this.transform = _config.transform; 
   this.transformMap = (_config.transformMap) ? copyData(_config.transformMap) : undefined;

   this.ignoreSourceUpdates = (_config.ignoreSourceUpdates == undefined) ? false : _config.ignoreSourceUpdates;
   this.isTarget = (_config.isTarget == undefined) ? false : _config.isTarget;
   this.priority = (_config.priority == undefined) ? 0 : _config.priority;
   this.outputValues = (_config.outputValues == undefined) ? {} : copyData(_config.outputValues);
   this.property = _config.property;

   this.sourcePropertyName = this.sourceName + ":" + this.property;

   this.uName = "sourcelistener:" + _owner.uName + ":" + this.sourceName + ":" + this.property;

   if (_config.steps) {
      this.pipeline = new Pipeline(_config.steps, this);
   }

   this.valid = false;
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
   this.valid = (this.source != undefined) ? true : false;


   if (this.valid) {
      this.source.on('property-changed', this.propertyChangedCallback);
      this.source.on('invalid', this.invalidCallback);
   }

   return this.valid;
}

SourceListener.prototype.refreshSource = function() {
   var ret = true;

   if (!this.valid)  {
      ret = this.establishListeners();
      console.log(this.uName + ': Refreshed source listener. result=' + ret);

      if (ret) {

         if (this.pipeline) {
            this.pipeline.sourceIsValid(copyData({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property }));
         }
         else {
            this.owner.sourceIsValid(copyData({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property }));
         }
      }
   }
   return ret;
}

SourceListener.prototype.internalSourceIsInvalid = function(_data) {
   console.log(this.uName + ': INVALID');

   if (this.valid) {
      this.valid = false;

      this.source.removeListener('property-changed', this.propertyChangedCallback);
      this.source.removeListener('invalid', this.invalidCallback);

      if (this.pipeline) {
         this.pipeline.sourceIsInvalid(copyData({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property }));
      }
      else {
         this.goInvalid(_data);
      }
   }
}

SourceListener.prototype.goValid = function(_data) {
   this.owner.sourceIsValid(copyData({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property }));
}

SourceListener.prototype.goInvalid = function(_data) {
   this.owner.sourceIsInvalid(copyData({ sourcePropertyName: this.sourcePropertyName, sourceName: this.sourceName, propertyName: this.property }));
}

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.outputFromPipeline = function(_pipeline, _newValue, _data) {
   _data.propertyValue = _newValue;
   this.sourcePropertyValue = newValue;

   if (this.isTarget) {
      this.owner.targetPropertyChanged(copyData(_data));
   }
   else {
      this.owner.sourcePropertyChanged(copyData(_data));
   }
};

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.sourceIsValidFromPipeline = function(_pipeline, _data) {
   this.goValid(_data);
}

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.sourceIsInvalidFromPipeline = function(_pipeline, _data) {
   this.goInvalid(_data);
}

SourceListener.prototype.transformInput = function(_data) {
   var input = _data.propertyValue;
   var newInput = input;

   if (this.transform) {
      var exp = this.transform.replace(/\$value/g, "input");
      eval("newInput = " + exp);
   }

   if (this.transformMap && this.transformMap[newInput] != undefined) {
      newInput = this.transformMap[newInput];
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
      console.log(this.uName + ": processing source property change, property=" + _data.propertyName);

      // ** TODO Do we need to cache data based on the propertyValue? Not done so far
      this.lastData = copyData(_data);
      this.lastData.sourcePropertyName = this.sourcePropertyName;
      this.sourceRawValue = _data.propertyValue;

      if (this.transform || this.transformMap) {
         this.lastData.propertyValue = this.transformInput(_data);
      }

      if (this.pipeline) {
         this.pipeline.process(this.lastData.propertyValue, this.lastData);
      }
      else {
         this.sourcePropertyValue = this.lastData.propertyValue;

         if (this.isTarget) {
            this.owner.targetPropertyChanged(copyData(this.lastData));
         }
         else {
            this.owner.sourcePropertyChanged(copyData(this.lastData));
         }
      }
   }
}

module.exports = exports = SourceListener;
 
