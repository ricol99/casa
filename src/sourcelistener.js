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

   this.maskInvalid = _config.hasOwnProperty("maskInvalidTimeout") || _config.hasOwnProperty("maskInvalidValue");
   this.maskInvalidValueDefined = _config.hasOwnProperty("maskInvalidValue");

   this.maskInvalidTimeout =  _config.hasOwnProperty("maskInvalidTimeout") ? _config.maskInvalidTimeout : -1;
   this.maskInvalidValue = _config.maskInvalidValue;

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
}

SourceListener.prototype.establishListeners = function() {

   if (this.listeningToPropertyChange) {
      this.propertyChangedHandler = SourceListener.prototype.propertyChangedCb.bind(this);
   }
   else {
      this.eventRaisedHandler = SourceListener.prototype.eventRaisedCb.bind(this);
   }

   this.invalidHandler = SourceListener.prototype.invalidCb.bind(this);

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.valid = (this.source != undefined);


   if (this.valid) {

      if (this.listeningToPropertyChange) {
         this.source.on('property-changed', this.propertyChangedHandler);
      }
      else {
         this.source.on('event-raised', this.eventRaisedHandler);
      }

      this.source.on('invalid', this.invalidHandler);
   }

   return this.valid;
}

SourceListener.prototype.propertyChangedCb = function(_data) {
   this.internalSourcePropertyChanged(_data);
};

SourceListener.prototype.eventRaisedCb = function(_data) {
   this.internalSourceEventRaised(_data);
};

SourceListener.prototype.invalidCb = function(_data) {
   this.internalSourceIsInvalid(_data);
};

SourceListener.prototype.refreshSource = function() {
   var ret = true;

   if (!this.valid)  {
      ret = this.establishListeners();
      console.log(this.uName + ': Refreshed source listener. result=' + ret);

      if (ret) {
         this.stopMaskInvalidTimer();

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

   if ((_data.name === this.eventName) && this.valid) {
      console.log(this.uName + ': INVALID');

      this.valid = false;

      if (this.listeningToPropertyChange) {
         this.source.removeListener('property-changed', this.propertyChangedHandler);
      }
      else {
         this.source.removeListener('event-raised', this.eventRaisedHandler);
      }

      this.source.removeListener('invalid', this.invalidHandler);

      if (this.maskInvalid) {

         if (this.maskInvalidValueDefined && (this.maskInvalidValue != this.sourceRawValue)) {
            _data.value = this.maskInvalidValue;
            this.internalSourcePropertyChanged(_data);
         }
         this.startMaskInvalidTimer();
      }
      else {
         if (this.pipeline) {
            this.pipeline.sourceIsInvalid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
         }
         else {
            this.goInvalid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
         }
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
};

//
// Internal method - Called by the last step in the pipeline
//
SourceListener.prototype.sourceIsInvalidFromPipeline = function(_pipeline, _data) {
   this.goInvalid(_data);
};

//
// Internal method
//
SourceListener.prototype.startMaskInvalidTimer = function() {

   if (this.maskInvalidTimeout != -1) {

      if (this.maskInvalidTimer) {
         this.stopMaskInvalidTimer();
      }

      this.maskInvalidTimer = setTimeout( () => {

         if (!this.valid) {

            if (this.maskInvalidValue != this.sourceRawValue) {
               this.internalSourcePropertyChanged(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName, value: this.sourceRawValue }));
            }

            if (this.pipeline) {
               this.pipeline.sourceIsInvalid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
            }
            else {
               this.goInvalid(copyData({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
            }
         }
      }, this.maskInvalidTimeout*1000);
   }
};

//
// Internal method
//
SourceListener.prototype.stopMaskInvalidTimer = function() {

   if (this.maskInvalidTimer) {
      clearTimeout(this.maskInvalidTimer);
      this.maskInvalidTimer = null;
   }
};

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
