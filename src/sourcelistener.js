var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');
var Pipeline = require('./pipeline');

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

   this.listeningToPropertyChange = _config.hasOwnProperty("property");

   if (this.listeningToPropertyChange) {
      this.eventName = _config.property;
   }
   else {
      this.eventName = _config.event;
   }

   this.sourceEventName = this.sourceName + ":" + this.eventName;
   this.uName = "sourcelistener:" + _owner.uName + ":" + this.sourceName + ":" + this.eventName;


   if (_config.steps) {
      this.pipeline = new Pipeline(_config.steps, this);
   }

   this.valid = false;
   this.casa.addSourceListener(this);

   var that = this;
}

SourceListener.prototype.establishListeners = function() {
   var that = this;

   if (this.listeningToPropertyChange) {
      this.propertyChangedCallback = function(_data) {
         that.internalSourcePropertyChanged(_data);
      };
   }
   else {
      this.eventRaisedCallback = function(_data) {
         that.internalSourceEventRaised(_data);
      };
   }

   this.invalidCallback = function(_data) {
      that.internalSourceIsInvalid(_data);
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.valid = (this.source != undefined) ? true : false;


   if (this.valid) {

      if (this.listeningToPropertyChange) {
         this.source.on('property-changed', this.propertyChangedCallback);
      }
      else {
         this.source.on('event-raised', this.eventRaisedCallback);
      }

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
            this.pipeline.sourceIsValid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
         }
         else {
            this.goValid();
         }
      }
   }
   return ret;
}

SourceListener.prototype.internalSourceIsInvalid = function(_data) {
   console.log(this.uName + ': INVALID');

   if (this.valid) {
      this.valid = false;

      if (this.listeningToPropertyChange) {
         this.source.removeListener('property-changed', this.propertyChangedCallback);
      }
      else {
         this.source.removeListener('event-raised', this.eventRaisedCallback);
      }

      this.source.removeListener('invalid', this.invalidCallback);

      if (this.pipeline) {
         this.pipeline.sourceIsInvalid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
      }
      else {
         this.goInvalid(_data);
      }
   }
}

SourceListener.prototype.goValid = function() {
   this.owner.sourceIsValid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
}

SourceListener.prototype.goInvalid = function(_data) {
   this.owner.sourceIsInvalid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
}

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.outputFromPipeline = function(_pipeline, _newValue, _data) {
   _data.value = _newValue;
   this.sourcePropertyValue = _newValue;

   if (this.isTarget) {
      this.owner.receivedEventFromTarget(copyData(_data));
   }
   else {
      this.owner.receivedEventFromSource(copyData(_data));
   }
};

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.sourceIsValidFromPipeline = function(_pipeline, _data) {
   this.goValid();
}

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.sourceIsInvalidFromPipeline = function(_pipeline, _data) {
   this.goInvalid(_data);
}

SourceListener.prototype.transformInput = function(_data) {
   var input = _data.value;
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
};

SourceListener.prototype.getSource = function() {
   return this.source;
};

SourceListener.prototype.isValid = function() {
   return this.valid;
};

SourceListener.prototype.internalSourcePropertyChanged = function(_data) {

   if (!this.ignoreSourceUpdates && _data.name == this.eventName) {
      console.log(this.uName + ": processing source property change, property=" + _data.name);

      this.lastData = copyData(_data);
      this.lastData.sourceEventName = this.sourceEventName;
      this.sourceRawValue = _data.value;

      if (this.transform || this.transformMap) {
         this.lastData.value = this.transformInput(_data);
      }

      if (this.pipeline) {
         this.pipeline.newInputForProcess(this.lastData.value, this.lastData);
      }
      else {
         this.sourcePropertyValue = this.lastData.value;

         if (this.isTarget) {
            this.owner.receivedEventFromTarget(copyData(this.lastData));
         }
         else {
            this.owner.receivedEventFromSource(copyData(this.lastData));
         }
      }
   }
};

SourceListener.prototype.internalSourceEventRaised = function(_data) {

   if (!this.ignoreSourceUpdates && _data.name == this.eventName) {
      console.log(this.uName + ": processing source event raised, event=" + _data.name);

      this.lastData = copyData(_data);
      this.lastData.sourceEventName = this.sourceEventName;
      this.sourceRawValue = _data.value;

      if (this.transform || this.transformMap) {
         this.lastData.value = this.transformInput(_data);
      }

      if (this.pipeline) {
         this.pipeline.newInputForProcess(this.lastData.value, this.lastData);
      }
      else if (this.isTarget) {
         this.owner.receivedEventFromTarget(copyData(this.lastData));
      }
      else {
         this.owner.receivedEventFromSource(copyData(this.lastData));
      }
   }
};

module.exports = exports = SourceListener;
 
