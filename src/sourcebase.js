var util = require('./util');
var NamedObject = require('./namedobject');
var Gang = require('./gang');

function SourceBase(_config, _owner) {
   NamedObject.call(this, _config, _owner);
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.bowing = false;
   this.currentTransaction = null;
   this.properties = {};
   this.subscribedSources = {};

   this.setMaxListeners(0);
}

util.inherits(SourceBase, NamedObject);

// Called when system state is required
SourceBase.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
};

// Called when system state is required
SourceBase.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
};

SourceBase.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);

   for (var prop in this.properties) {

      if (this.properties.hasOwnProperty(prop)) {
         this.properties[prop].coldStart();
      }
   }
};

SourceBase.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
};

SourceBase.prototype.newTransaction = function() {
   this.currentTransaction = this.uName + "-" + Date.now();
   return this.currentTransaction;
};

SourceBase.prototype.checkTransaction = function() {
   if (!this.currentTransaction) console.log(this.uName + ": Created a new transaction as currentTransaction not defined");
   return (!this.currentTransaction) ? this.newTransaction() : this.currentTransaction;
};

SourceBase.prototype.newTimeoutTransaction = function() {
   return this.modifyTransaction("T");
};

SourceBase.prototype.newScheduledTransaction = function() {
   return this.modifyTransaction("S");
};

SourceBase.prototype.modifyTransaction = function(_strToAppend) {
   this.currentTransaction = this.checkTransaction() + _strToAppend;
   return this.currentTransaction;
};

SourceBase.prototype.getCasa = function() {
   return this.casa;
};

// Override this if you want to create sources on demand - based on subscription (used by services)
SourceBase.prototype.interestInNewChild = function(_uName) {
};

SourceBase.prototype.subscriptionRegistered = function(_event, _subscription) {
   console.log(this.uName+": subscriptionRegistered() :" + _event);
   var newSource = false;

   if (_subscription.hasOwnProperty("listeningSource")) {

      if (this.subscribedSources[_subscription.listeningSource]) {
         this.subscribedSources[_subscription.listeningSource] = this.subscribedSources[_subscription.listeningSource] + 1;
      }
      else {
         this.subscribedSources[_subscription.listeningSource] = 1;
         newSource = true;
      } 
   }

   if (_event === "property-changed") {
      this.propertySubscribedTo(_subscription.property, _subscription, this.properties.hasOwnProperty(_subscription.property), newSource);
   }
   else {
      this.eventSubscribedTo(_event, _subscription, newSource);
   }
};

SourceBase.prototype.subscriptionRemoved = function(_event, _subscription) {
   console.log(this.uName+": subscriptionRemoved() :" + _event);

   var lastSource = false;

   if (_subscription.hasOwnProperty("listeningSource")) {

      if (this.subscribedSources[_subscription.listeningSource]) {
         this.subscribedSources[_subscription.listeningSource] = this.subscribedSources[_subscription.listeningSource] - 1;

         if (this.subscribedSources[_subscription.listeningSource] === 0) {
            delete this.subscribedSources[_subscription.listeningSource];
            lastSource = true;
         }
      }
   }

   if (_event === "property-changed") {
      this.propertySubscriptionRemoved(_subscription.property, _subscription, this.properties.hasOwnProperty(_subscription.property), lastSource);
   }
   else {
      this.eventSubscriptionRemoved(_event, _subscription, lastSource);
   }
};

// Override this to learn of new subscriptions to properties
// _property - property name
// _subscription - usually an object - provided by subscriber
// _exists - whether the property is currently defined in this source
// _firstSource - true if the listener currently has no subscriptions with this source - i.e. this is the first one
SourceBase.prototype.propertySubscribedTo = function(_property, _subscription, _exists, _firstSource) {
};

// Override this to learn of new subscriptions to events
// _event - event name
// _subscription - usually an object - provided by subscriber
// _firstSource - true if the listener currently has no subscriptions with this source - i.e. this is the first one
SourceBase.prototype.eventSubscribedTo = function(_event, _subscription, _firstSource) {
};

// Override this to learn of of a removal of a subscription to a property
// _property - property name
// _subscription - usually an object - provided by subscriber
// _exists - whether the property is currently defined in this source
// _lastSource - true if the listener is about to remove itss last subscriptions from this source - i.e. this is the last one to go
SourceBase.prototype.propertySubscriptionRemoved = function(_property, _subscription, _exists, _lastSource) {
};

// Override this to learn of a removal of a subscription to an event
// _event - event name
// _subscription - usually an object - provided by subscriber
// _lastSource - true if the listener is about to remove itss last subscriptions from this source - i.e. this is the last one to go
SourceBase.prototype.eventSubscriptionRemoved = function(_event, _subscription, _lastSource) {
};

SourceBase.prototype.bowToOtherSource = function(_currentlyActive, _topOfTree) {
   console.log(this.uName+": Bowing to new source");
   this.bowing = true;
   this.local = true;

   if (_currentlyActive) {
      this.loseListeners(true);
   }

   if (_topOfTree) {
      this.casa.bowSource(this, _currentlyActive);
   }
};

SourceBase.prototype.standUpFromBow = function() {
   console.log(this.uName+": Standing up to lower priority source");

   this.bowing = false;
   this.local = this.config.hasOwnProperty("local") ? this.config.local : false;
   var currentSource = this.gang.findNamedObject(this.uName);

   if (currentSource) {
      currentSource.bowToOtherSource(true, true);
   }
   this.casa.standUpSourceFromBow(this);
}

SourceBase.prototype.isPropertyValid = function(_property) {

   if (this.properties.hasOwnProperty(_property)) {
      return this.properties[_property].valid;
   }
   else {
      return true;
   }
};

SourceBase.prototype.hasProperty = function(_property) {
   return this.properties.hasOwnProperty(_property);
};

SourceBase.prototype.getProperty = function(_property) {

   if (!this.properties.hasOwnProperty(_property)) {
      console.error(this.uName + ": Asked for property " + _property + " that I don't have.");
   }

   return (this.properties.hasOwnProperty(_property)) ? this.properties[_property].getValue() : undefined;
};

SourceBase.prototype.getAllProperties = function(_allProps) {

   for (var prop in this.properties) {

      if (this.properties.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = this.properties[prop].value;
      }
   }
};

SourceBase.prototype.findAllProperties = function(_allProps) {

   for (var prop in this.properties) {

      if (this.properties.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = { value: this.properties[prop].value, local: this.properties[prop].local };
      }
   }
};

SourceBase.prototype.propertyGoneInvalid = function(_propName, _data) {
   console.log(this.uName + ": Property " + _propName + " going invalid! Previously active state=" + this.properties[_propName].value);

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.sourceName =  this.uName;
   sendData.oldState = this.properties[_propName].value;
   sendData.name = _propName;
   console.log(this.uName + ": Emitting invalid!");

   this.emit('invalid', sendData);
};

SourceBase.prototype.eventGoneInvalid = function(_eventName, _data) {
   console.log(this.uName + ": Event " + _eventName + " going invalid!");

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.sourceName =  this.uName;
   sendData.name = _eventName;
   console.log(this.uName + ": Emitting invalid!");

   this.emit('invalid', sendData);
};

SourceBase.prototype.invalidate = function(_includeChildren) {
   console.log(this.uName + ": Raising invalid on all properties to drop source listeners");
 
   if (this.alignmentTimeout || (this.propertyAlignmentQueue && (this.propertyAlignmentQueue.length > 0))) {
      this.clearAlignmentQueue();
   }

   for (var prop in this.properties) {
 
      if (this.properties.hasOwnProperty(prop)) {
         this.properties[prop].invalidate();
      }
   }
};

SourceBase.prototype.loseListeners = function(_includeChildren) {

   for (var prop in this.properties) {

      if (this.properties.hasOwnProperty(prop)) {
         this.properties[prop].loseListeners();
      }
   }

   for (var event in this.events) {

      if (this.events.hasOwnProperty(event)) {
         this.events[event].loseListeners();
      }
   }
};

SourceBase.prototype.updateProperty = function(_propName, _propValue, _data) {
   this.emitPropertyChange(_propName, _propValue, _data);
   return _propValue;
};

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
SourceBase.prototype.emitPropertyChange = function(_propName, _propValue, _data) {
   console.info(this.uName + ': Property Changed: ' + _propName + ': ' + _propValue);

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.sourceName = this.uName;
   sendData.name = _propName;
   sendData.value = _propValue;
   sendData.local = this.local;

   if (!sendData.hasOwnProperty("transaction")) {
      sendData.transaction = this.checkTransaction();
   }

   this.asyncEmit('property-changed', sendData);
};

SourceBase.prototype.alignPropertyRamp = function(_propName, _rampConfig) {
   this.alignProperties([ { property: _propName, ramp: _rampConfig } ]);
};

SourceBase.prototype.alignPropertyValue = function(_propName, _nextPropValue) {
   this.alignProperties([ { property: _propName, value: _nextPropValue } ]);
};

SourceBase.prototype.rejectPropertyUpdate = function(_propName) {
   this.alignPropertyValue(_propName, this.properties[_propName].value);
};

SourceBase.prototype.ensurePropertyExists = function(_propName, _propType, _config, _mainConfig) {
   var addProperty = true;

   if (!(_config.hasOwnProperty("childInherited") || _config.hasOwnProperty("parentInherited"))) {

      if (this.properties.hasOwnProperty(_propName) && (this.properties[_propName].config.childInherited || this.properties[_propName].config.parentInherited)) {
         return this.overrideExistingProperty(_propName, _propType, _config, _mainConfig);
      }
   }

   if (!this.properties.hasOwnProperty(_propName)) {
      _config.name = _propName;
      _config.type = _propType;
      _config.transient = true;
      this.createChild(_config, "property", this);

      if (_mainConfig) {

         if (!_mainConfig.hasOwnProperty("properties")) {
            _mainConfig.properties = [ _config ];
         }
         else {
            _mainConfig.properties.push(_config);
         }
      }
      return true;
   }
   return false;
};

SourceBase.prototype.overrideExistingProperty = function(_propName, _propType, _config, _mainConfig) {

   if (this.properties.hasOwnProperty(_propName)) {
      this.properties[_propName]._cleanUp();
      this.removeChildNamedObject(this.properties[_propName]);
   }

   this.ensurePropertyExists(_propName, _propType, _config, _mainConfig) ;
};

SourceBase.prototype.raiseEvent = function(_eventName, _data) {

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.local = this.local;
   sendData.sourceName = this.uName;
   sendData.name = _eventName;

   if (!sendData.hasOwnProperty("transaction")) {
      sendData.transaction = this.checkTransaction();
   }

   if (!sendData.hasOwnProperty("value")) {
      sendData.value = true;
   }

   console.log(this.uName + ": Emitting event " + _eventName);
   this.asyncEmit('event-raised', sendData);
}

SourceBase.prototype.changeName = function(_newName) {
   this.setName(_newName);

   for (var prop in this.properties) {

      if (this.properties.hasOwnProperty(prop)) {
         this.properties[prop].ownerHasNewName();
      }
   }
};

// Called by peerSource to check for overriding
SourceBase.prototype.deferToPeer = function(_newSource) {
   return (_newSource.priority > this.priority);
};

// Called by peerSource to check for overriding
SourceBase.prototype.becomeMainSource = function() {

   if (this.bowing) {
      console.log(this.uName + ": Becoming main source again!");
      return this.standUpFromBow();
   }

   return false;
};

SourceBase.prototype.alignPropertyRamp = function(_propName, _rampConfig) {
   this.alignProperties([ { property: _propName, ramp: _rampConfig } ]);
};

// Please override these two methods to actually set property values
SourceBase.prototype.setProperty = function(_propName, _propValue, _data) {
   return false;
};

SourceBase.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   return false;
};

SourceBase.prototype.alignPropertyValue = function(_propName, _nextPropValue) {
   this.alignProperties([ { property: _propName, value: _nextPropValue } ]);
};

SourceBase.prototype.alignProperties = function(_properties) {

   if (_properties && (_properties.length > 0)) {
      console.log(this.uName + ": alignProperties() ", _properties.length);
      this.addPropertiesForAlignment(_properties);
      this.alignNextProperty();
   }
};

// Internal
SourceBase.prototype.addPropertiesForAlignment = function(_properties) {

   if (!this.propertyAlignmentQueue) {
      this.propertyAlignmentQueue = [];
   }

   for (var i = 0; i < _properties.length; ++i) {

      if (_properties[i].hasOwnProperty("ramp")) {
         var ramp = util.copy(_properties[i].ramp);

         if (_properties[i].ramp.hasOwnProperty("ramps")) {
            ramp.ramps = util.copy(_properties[i].ramp.ramps, true);
         }

         this.propertyAlignmentQueue.push({ property: _properties[i].property, ramp: ramp, transaction: this.checkTransaction() });
      }
      else {
         console.log(this.uName + ": addPropertyForAlignment() property=" + _properties[i].property + " value=" + _properties[i].value);
         this.propertyAlignmentQueue.push({ property: _properties[i].property, value: _properties[i].value, transaction: this.checkTransaction() });
      }
   }
};

// Internal
SourceBase.prototype.alignNextProperty = function() {

   if (!this.alignmentTimeout && (this.propertyAlignmentQueue.length > 0)) {

      this.alignmentTimeout = setTimeout( () => {
         this.alignmentTimeout = null;

         if (this.propertyAlignmentQueue.length > 0) {
            var prop = this.propertyAlignmentQueue.shift();

            if (prop.hasOwnProperty("ramp")) {
               console.log(this.uName + ": Setting property " + prop.property + " to ramp");
               this.setPropertyWithRamp(prop.property, prop.ramp, { sourceName: this.uName, transaction: prop.transaction });
            }
            else {
               console.log(this.uName + ": Setting property " + prop.property + " to value " + prop.value);
               this.setProperty(prop.property, prop.value, { sourceName: this.uName, transaction: prop.transaction });
            }
            this.alignNextProperty();
         }
         else {
            console.error(this.uName + ": Something has gone wrong as no alignments are in the queue!");
         }
      }, 1);
   }
};

SourceBase.prototype.clearAlignmentQueue = function() {
   clearTimeout(this.alignmentTimeout);
   this.alignmentTimeout = null;
   this.propertyAlignmentQueue = [];
}

SourceBase.prototype.generateDynamicSourceId = function(_config) {
   var config = {};
   var config = { uName: _config.hasOwnProperty("uName") ? _config.uName : this.owner.uName };

   if (_config.hasOwnProperty("property")) {
      config.property = _config.property;
   }
      
   if (_config.hasOwnProperty("event")) {
      config.event = _config.event;
   }

   if (_config.hasOwnProperty("value")) {
      config.value = _config.value;
   }
      
   if (_config.hasOwnProperty("guard")) {
      config.guard = _config.guard;
   }
   
   return JSON.stringify(config);
};

module.exports = exports = SourceBase;
 
