var util = require('./util');
var Source = require('./source');
var Gang = require('./gang');
var NamedObject = require('./namedobject');

function SourceListener(_config, _owner) {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;

   this.sourceName = this.gang.uNameToLongForm(_config.uName);

   if (_config.uName == undefined) {
      console.log("sourcelistener: sourceName undefined = "+this.sourceName);
   }

   if (_config.hasOwnProperty("id")) {
      this.id = _config.id;
   }

   // TBD: HACK!
   if ((this.sourceName === _owner.uName) || (_owner.hasOwnProperty("owner") && (this.sourceName === _owner.owner.uName))) {
      this.listeningToMyself = true;
   }

   if (_config.hasOwnProperty('transform')) {
      this.transform = _config.transform;
   }

   if (_config.hasOwnProperty('transformMap')) {
      this.transformMap = util.copy(_config.transformMap);
   }

   this.ignoreSourceUpdates = (_config.hasOwnProperty('ignoreSourceUpdates')) ? _config.ignoreSourceUpdates : false;
   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : 0;
   this.outputValues = (_config.hasOwnProperty('outputValues')) ? util.copy(_config.outputValues) : {};

   this.maskInvalid = (_config.hasOwnProperty('maskInvalidTimeout')) || _config.hasOwnProperty("maskInvalidValue");
   this.maskInvalidValueDefined = _config.hasOwnProperty('maskInvalidValue');

   this.maskInvalidTimeout =  (_config.hasOwnProperty('maskInvalidTimeout')) ? _config.maskInvalidTimeout : -1;
   this.maskInvalidValue = _config.maskInvalidValue;

   this.listeningToPropertyChange = _config.hasOwnProperty("property");
   this.subscription = (_config.hasOwnProperty("subscription")) ? _config.subscription : {};
   this.subscription.listeningSource = _config.listeningSource;

   if (!this.subscription.hasOwnProperty("sourceName")) {
      this.subscription.sourceName = this.sourceName;
   }

   if (this.listeningToPropertyChange) {
      this.eventName = _config.property;
      this.subscription.property = this.eventName;
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

   NamedObject.call(this, { name: this.sourceEventName.substr(2).replace(/:/g, "-"), type: "sourcelistener" }, _owner);

   this._id = this.uName;   // *** TBD

   this.valid = false;
   this.maskingInvalid = false;
   this.wasMaskingInvalid = false;
   this.listening = false;

   this.casa.addSourceListener(this);

   console.log(this.uName+": Sourcelistener created!");
}

util.inherits(SourceListener, NamedObject);

// Used to classify the type and understand where to load the javascript module
SourceListener.prototype.superType = function(_type) {
   return "sourcelistener";
};

// Called when system state is required
SourceListener.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   _exportObj.sourceRawValue = this.sourceRawValue;
   _exportObj.sourcePropertyValue = this.sourcePropertyValue;
   _exportObj.valid = this.valid;
};

// Called before hotStart to system state
SourceListener.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
   this.sourceRawValue = _importObj.sourceRawValue;
   this.sourcePropertyValue = _importObj.sourcePropertyValue;
   this.valid = _importObj.valid;
};

SourceListener.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
};

SourceListener.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
   this.establishListeners();
};

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
   this.valid = this.source && !this.source.bowing;

   if (this.valid && !this.listening) {

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
         this.source.on('event-raised', this.eventRaisedHandler, this.subscription);
      }

      this.source.on('invalid', this.invalidHandler);
      this.listening = true;
   }

   return this.valid;
}

SourceListener.prototype.stopListening = function() {

   if (this.listening) {

      if (this.listeningToPropertyChange) {
         this.source.removeListener('property-changed', this.propertyChangedHandler, this.subscription);
      }
      else {
         this.source.removeListener('event-raised', this.eventRaisedHandler, this.subscription);
      }

      this.source.removeListener('invalid', this.invalidHandler, this.subscription);
   }

   this.casa.removeSourceListener(this);
   this.listening = false;
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

   if (this.hasOwnProperty("listeningToMyself") && this.listeningToMyself) {
      return;
   }

   if ((_data.name === this.eventName) && this.valid) {
      console.log(this.uName + ': INVALID');
      this.valid = false;

      if (this.listeningToPropertyChange) {
         this.source.removeListener('property-changed', this.propertyChangedHandler, this.subscription);
      }
      else {
         this.source.removeListener('event-raised', this.eventRaisedHandler, this.subscription);
      }

      this.source.removeListener('invalid', this.invalidHandler, this.subscription);
      this.listening = false;

      if (this.maskInvalid) {
         this.maskingInvalid = true;
         this.valueBeforeMasking = this.sourceRawValue;

         if (this.maskInvalidValueDefined && (this.maskInvalidValue != this.sourceRawValue)) {
            this.internalSourcePropertyChanged(util.copy({ sourceName: this.sourceName, name: this.eventName, value: this.maskInvalidValue }));
         }
         this.startMaskInvalidTimer();
      }
      else {
         this.owner.sourceIsInvalid(util.copy({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
      }
   }
}

SourceListener.prototype.goValid = function() {
   this.owner.sourceIsValid(util.copy({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));

   if (this.subscription && this.subscription.hasOwnProperty("property") && this.source.properties.hasOwnProperty(this.eventName)) {

      if (!this.source.properties[this.eventName].cold || this.source.properties[this.eventName].initialValueSet) {
         this.internalSourcePropertyChanged(util.copy({ sourceName: this.sourceName, name: this.eventName, value: this.source.getProperty(this.eventName), coldStart: true }));
      }
   }
}

SourceListener.prototype.makeClientAwareOfEvent = function(_data) {

   if (this.matchingValueDefined && (this.sourceRawValue !== this.matchingValue)) {
      return;
   }

   console.log(this.uName + ": processing source event raised, event=" + _data.name);
   this.casa.eventLogger.logReceivedEvent(this.owner.uName, _data);
   this.owner.receivedEventFromSource(util.copy(_data));
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
            this.owner.sourceIsInvalid(util.copy({ sourceEventName: this.sourceEventName, sourceName: this.sourceName, name: this.eventName }));
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
      this.casa.eventLogger.logReceivedEvent(this.owner.uName, newData);
      this.owner.receivedEventFromSource(newData);
   }
   else if (!this.ignoreSourceUpdates && _data.name == this.eventName) {
      this.lastData = util.copy(_data);
      this.lastData.sourceEventName = this.sourceEventName;
      this.lastData.propertyChange = true;
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
      var newData = util.copy(_data);
      newData.propertyChange = false;
      this.casa.eventLogger.logReceivedEvent(this.owner.uName, newData);
      this.owner.receivedEventFromSource(newdata);
   }
   else if (!this.ignoreSourceUpdates && _data.name == this.eventName) {
      this.lastData = util.copy(_data);
      this.lastData.sourceEventName = this.sourceEventName;
      this.lastData.propertyChange = false;

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

SourceListener.prototype.getId = function() {
   return this.id;
};

module.exports = exports = SourceListener;
