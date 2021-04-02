var util = require('./util');
var Source = require('./source');
var Gang = require('./gang');
var NamedObject = require('./namedobject');

function SourceListener(_config, _owner) {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.owner = _owner;

   this.sourceName = this.gang.uNameToLongForm(_config.uName);

   if (_config.uName == undefined) {
      console.log("sourcelistener: sourceName undefined = "+this.sourceName);
   }

   if (_config.hasOwnProperty('transform')) {
      this.transform = _config.transform;
   }

   if (_config.hasOwnProperty('transformMap')) {
      this.transformMap = util.copy(_config.transformMap);
   }

   this.ignoreSourceUpdates = (_config.hasOwnProperty('ignoreSourceUpdates')) ? _config.ignoreSourceUpdates : false;
   this.isTarget = (_config.hasOwnProperty('isTarget')) ? _config.isTarget : false;
   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : 0;
   this.outputValues = (_config.hasOwnProperty('outputValues')) ? util.copy(_config.outputValues) : {};

   this.maskInvalid = (_config.hasOwnProperty('maskInvalidTimeout')) || _config.hasOwnProperty("maskInvalidValue");
   this.maskInvalidValueDefined = _config.hasOwnProperty('maskInvalidValue');

   this.maskInvalidTimeout =  (_config.hasOwnProperty('maskInvalidTimeout')) ? _config.maskInvalidTimeout : -1;
   this.maskInvalidValue = _config.maskInvalidValue;

   this.listeningToPropertyChange = _config.hasOwnProperty("property");
   this.subscription = (_config.hasOwnProperty("subscription")) ? _config.subscription : {};

   if (this.listeningToPropertyChange) {
      this.eventName = _config.property;
      this.subscription.prop = this.eventName;
   }
   else if (_config.hasOwnProperty("event")) {
      this.eventName = _config.event;
      this.subscription.event = this.eventName;
   }
   else {
      this.eventName = "mirror";
      this.subscription.mirror = true;
      this.capturingAllEvents = true;
   }

   this.matchingValueDefined = _config.hasOwnProperty('value');

   if (this.matchingValueDefined) {
      this.matchingValue = _config.value;
      this.sourceEventName = this.sourceName + ":" + this.eventName + ":" + this.matchingValue.toString();
   }
   else {
      this.sourceEventName = this.sourceName + ":" + this.eventName;
   }

   if (!this.owner.uName) {
      console.error('Owner '+this.owner.uName + ' is not a named object!');
      process.exit(1);
   }

   NamedObject.call(this, { name: this.sourceEventName.substr(2).replace(/:/g, "-"), type: "sourcelistener" }, this.owner);

   this._id = this.uName;   // *** TBD

   this.valid = false;
   this.maskingInvalid = false;
   this.wasMaskingInvalid = false;

   this.casa.addSourceListener(this);
}

util.inherits(SourceListener, NamedObject);

SourceListener.prototype.establishListeners = function() {

   if (this.listeningToPropertyChange) {
      this.propertyChangedHandler = SourceListener.prototype.propertyChangedCb.bind(this);
   }
   else if (this.capturingAllEvents) {
      this.propertyChangedHandler = SourceListener.prototype.propertyChangedCb.bind(this);
      this.eventRaisedHandler = SourceListener.prototype.eventRaisedCb.bind(this);
   }
   else  {
      this.eventRaisedHandler = SourceListener.prototype.eventRaisedCb.bind(this);
   }

   this.invalidHandler = SourceListener.prototype.invalidCb.bind(this);

   // refresh source
   this.source = this.gang.findNamedObject(this.sourceName);
   this.valid = this.source ? true : false;

   if (this.valid) {

      if (this.listeningToPropertyChange) {
         this.source.on('property-changed', this.propertyChangedHandler, this.subscription);

         if (!this.source.hasProperty(this.eventName)) {
            console.log(this.uName + ": Sourcelistener listening to non-existent property " + this.eventName + " on source " + this.source.uName + ". Fix config!");
            this.valid = false;
         }
      }
      else if (this.capturingAllEvents) {
         this.source.on('property-changed', this.propertyChangedHandler, this.subscription);
         this.source.on('event-raised', this.eventRaisedHandler);
      }
      else {
         this.source.on('event-raised', this.eventRaisedHandler);
      }

      this.source.on('invalid', this.invalidHandler);
   }

   return this.valid;
}

SourceListener.prototype.stopListening = function() {

   if (this.listeningToPropertyChange) {
      this.source.removeListener('property-changed', this.propertyChangedHandler);
   }
   else {
      this.source.removeListener('event-raised', this.eventRaisedHandler);
   }

   this.source.removeListener('invalid', this.invalidHandler);
   this.casa.removeSourceListener(this);
};

SourceListener.prototype.propertyChangedCb = function(_data) {

   if (this.wasMaskingInvalid && _data.coldStart) {
      this.wasMaskingInvalid = false;
   }
   else {
      this.internalSourcePropertyChanged(_data);
   }
};

SourceListener.prototype.eventRaisedCb = function(_data) {
   this.internalSourceEventRaised(_data);
};

SourceListener.prototype.invalidCb = function(_data) {
   this.internalSourceIsInvalid(_data);
};

SourceListener.prototype.refreshSource = function() {
   console.log(this.uName + ': refreshSource() current validity =' + this.valid);
   var ret = true;

   if (!this.valid)  {
      ret = this.establishListeners();
      console.log(this.uName + ': Refreshed source listener. result=' + ret);

      if (ret) {
         this.stopMaskInvalidTimer();
         this.goValid();
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
         this.maskingInvalid = true;
         this.valueBeforeMasking = this.sourceRawValue;

         if (this.maskInvalidValueDefined && (this.maskInvalidValue != this.sourceRawValue)) {
            this.internalSourcePropertyChanged(util.copy({ sourceName: this.sourceName, name: this.eventName, value: this.maskInvalidValue }));
         }
         this.startMaskInvalidTimer();
      }
      else {
         this.invalidate();
      }
   }
}

SourceListener.prototype.goValid = function() {
   this.owner.sourceIsValid(util.copy({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));

   if (this.subscription && this.subscription.hasOwnProperty("prop") && this.source.props.hasOwnProperty(this.eventName)) {

      if (!this.source.props[this.eventName].cold || this.source.props[this.eventName].initialValueSet) {
         this.internalSourcePropertyChanged(util.copy({ sourceName: this.sourceName, name: this.eventName, value: this.source.getProperty(this.eventName), coldStart: true }));
      }
   }
}

SourceListener.prototype.invalidate = function() {
   this.owner.sourceIsInvalid(util.copy({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
}

SourceListener.prototype.makeClientAwareOfEvent = function(_data) {

   if (this.matchingValueDefined && (this.sourceRawValue !== this.matchingValue)) {
      return;
   }

   console.log(this.uName + ": processing source event raised, event=" + _data.name);

   if (this.isTarget) {
      this.owner.receivedEventFromTarget(util.copy(_data));
   }
   else {
      this.owner.receivedEventFromSource(util.copy(_data));
   }
};

SourceListener.prototype.isCold = function() {
   return !(this.hasOwnProperty("sourcePropertyValue"));
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
         this.maskingInvalid = false;
         this.maskInvalidTimer = null;

         if (!this.valid) {
            this.invalidate();
         }
      }, this.maskInvalidTimeout*1000);
   }
};

//
// Internal method
//
SourceListener.prototype.stopMaskInvalidTimer = function() {

   if (this.maskingInvalid) {
      this.maskingInvalid = false;
      this.wasMaskingInvalid = true;
      this.sourceRawValue = this.valueBeforeMasking;

      if (this.maskInvalidTimer) {
         clearTimeout(this.maskInvalidTimer);
         this.maskInvalidTimer = null;
      }
   }
};

SourceListener.prototype.transformInput = function(_data) {
   var input = _data.hasOwnProperty("value") ? _data.value : false;
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

SourceListener.prototype.getPropertyValue = function() {
   return this.sourcePropertyValue;
};

SourceListener.prototype.getSource = function() {
   return this.source;
};

SourceListener.prototype.getSourceName = function() {
   return this.sourceName;
};

SourceListener.prototype.isValid = function() {
   return this.maskingInvalid ? true : this.valid;
};

SourceListener.prototype.internalSourcePropertyChanged = function(_data) {

   if (this.capturingAllEvents) {
       var newData = util.copy(_data);
       newData.propertyChange = true;
       this.owner.receivedEventFromSource(newData);
   }
   else if (!this.ignoreSourceUpdates && _data.name == this.eventName) {
      this.lastData = util.copy(_data);
      this.lastData.sourceEventName = this.sourceEventName;
      this.sourceRawValue = _data.value;

      if (this.transform || this.transformMap) {
         this.lastData.value = this.transformInput(_data);
      }

      this.sourcePropertyValue = this.lastData.value;
      this.makeClientAwareOfEvent(this.lastData);
   }
};

SourceListener.prototype.internalSourceEventRaised = function(_data) {

   if (this.capturingAllEvents) {
       this.owner.receivedEventFromSource(util.copy(_data));
   }
   else if (!this.ignoreSourceUpdates && _data.name == this.eventName) {
      this.lastData = util.copy(_data);
      this.lastData.sourceEventName = this.sourceEventName;

      if (!this.lastData.hasOwnProperty("value")) {
         this.lastData.value = true;
      }
      else if (this.transform || this.transformMap) {
         this.lastData.value = this.transformInput(_data);
      }

      this.sourceRawValue = this.lastData.value;
      this.makeClientAwareOfEvent(this.lastData);
   }
};

module.exports = exports = SourceListener;
