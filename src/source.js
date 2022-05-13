var util = require('./util');
var SourceBase = require('./sourcebase');

function Source(_config, _owner) {
   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   SourceBase.call(this, _config, _owner);

   this.casa = this.gang.casa;
   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : 0;
   this.manualOverrideTimeout = (_config.hasOwnProperty('manualOverrideTimeout')) ? _config.manualOverrideTimeout : 3600;
   this.controllerPriority = -1;
   this.controller = null;

   if (_config.hasOwnProperty("mirrorSource")) {
      this.mirroring = true;
      var SourceListener = require('./sourcelistener');
      this.mirrorSourceListener = new SourceListener({ uName: _config.mirrorSource, subscription: _config.mirrorSourceSubscription }, this);
   }

   this.createChildren(_config.properties, "property", this);
   this.createChildren(_config.events, "event", this);

   this.ensurePropertyExists('MODE', 'stateproperty',
                             { "initialValue": 'auto', "takeControlOnTransition": true,
                               "states": [ { name: "auto", priority: -100 },
                                           { name: "manual", priority: 100, timeout: { "duration": this.manualOverrideTimeout, "nextState": "auto" }}]}, _config);
   if (this.casa) {
      console.log(this.uName + ': Source casa: ' + this.casa.uName);
      this.casa.addSource(this);
   }
}

util.inherits(Source, SourceBase);

// Called when system state is required
Source.prototype.export = function(_exportObj) {
   SourceBase.prototype.export.call(this, _exportObj);
   _exportObj.priority = this.priority;
   _exportObj.controllerPriority = this.controllerPriority;
   _exportObj.controller = this.controller ? this.controller.uName : null;
};

// Called before hotStart to restore system state 
Source.prototype.import = function(_importObj) {
   SourceBase.prototype.import.call(this, _importObj);
   this.priority = _importObj.priority;
   this.controllerPriority = _importObj.controllerPriority;
   this.controller = _importObj.controller ? this.gang.findNamedObject(_importObj.controller) : null;
};

Source.prototype.coldStart = function() {
   SourceBase.prototype.coldStart.call(this);

   for (var event in this.events) {

      if (this.events.hasOwnProperty(event)) {
         this.events[event].coldStart();
      }
   }
};

Source.prototype.hotStart = function() {
   SourceBase.prototype.hotStart.call(this);

   for (var event in this.events) {

      if (this.events.hasOwnProperty(event)) {
         this.events[event].hotStart();
      }
   }
};

Source.prototype.createProperty = function(_config) {

   if (this.properties.hasOwnProperty(_config.name)) {
      return false;
   }

   this.ensurePropertyExists(_config.name, (_config.hasOwnProperty("type")) ? _config.type : 'property', _config); 
   return true;
};

Source.prototype.changeName = function(_newName) {
   this.casa.renameSource(this, _newName);
   SourceBase.prototype.changeName.call(this, _newName);
};

Source.prototype.getScheduleService = function() {
  var scheduleService =  this.casa.findService("scheduleservice");

  if (!scheduleService) {
     console.error(this.uName + ": ***** Schedule service not found! *************");
     process.exit(3);
   }

   return scheduleService;
};

Source.prototype.raiseEvent = function(_eventName, _data) {

   if (this.events.hasOwnProperty(_eventName)) {
      this.events[_eventName].eventAboutToBeRaised(_eventName, _data);
   }

   this.eventAboutToBeRaised(_eventName, _data);
   SourceBase.prototype.raiseEvent.call(this, _eventName, _data);
};

// Override this to be informed when an event is being raised
Source.prototype.eventAboutToBeRaised = function(_eventName, _data) {
};

Source.prototype.scheduledEventTriggered = function(_event) {
   console.log(this.uName + ": scheduledEventTriggered() event=" + _event.name);

   if (_event.hasOwnProperty("ramp")) {
      console.error(this.uName + ": Ramps are not supported for this type of scheduled event");
      return;
   }

   if (_event.hasOwnProperty("name")) {

      if (_event.hasOwnProperty("value")) {
         this.raiseEvent(_event.name, { sourceName: this.uName, value: _event.value });
      }
      else {
         this.raiseEvent(_event.name, { sourceName: this.uName });
      }
   }
};

Source.prototype.getRampService = function() {
  var rampService =  this.casa.findService("rampservice");

  if (!rampService) {
     console.error(this.uName + ": ***** Ramp service not found! *************");
     process.exit(3);
   }

   return rampService;
};

Source.prototype.setProperty = function(_propName, _propValue, _data) {

   if (this.properties.hasOwnProperty(_propName)) {
      console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ' + _propValue);
      return this.properties[_propName].set(_propValue, _data);
   }
   else {
      return false;
   } 
};

Source.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {

   if (this.properties.hasOwnProperty(_propName)) {
      console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ramp');
      return this.properties[_propName].setWithRamp(_ramp, _data);
   }
   else {
      return false;
   } 
};

// Override this for last output hook - e.g. sync and external property with the final property value
Source.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (this.capturingAllEvents && this.mirrorSourceListener.isValid() && this.mirrorSourceListener.getSource().hasProperty(_propName)) {

      if (this.mirrorSourceListener.getSource().getProperty(_propName) != _propValue) {
         this.mirrorSourceListener.getSource().alignPropertyValue(_propName, _propValue);
      }
   }
};

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
Source.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.properties.hasOwnProperty(_propName)) {
      console.log(this.uName + ": updateProperty prop="+_propName+" value="+_propValue);

      if ((!(_data && _data.hasOwnProperty("coldStart") && _data.coldStart)) && (_propValue === this.properties[_propName].value)) {
         return true;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.properties[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName =  this.uName;
      sendData.name = _propName;
      sendData.propertyOldValue = oldValue;
      sendData.value = _propValue;

      if (this.local) {
         sendData.local = true;
      }

      // Call the final hooks
      this.properties[_propName].propertyAboutToChange(_propValue, _data);
      this.propertyAboutToChange(_propName, _propValue, _data);

      console.info(this.uName + ': Property Changed: ' + _propName + ': ' + _propValue);
      this.properties[_propName]._actuallySetPropertyValue(_propValue, _data);

      if (sendData.hasOwnProperty("priority")) {
         _data.priority = sendData.priority;
      }

      delete sendData.alignWithParent;	// This should never be emitted - only for composite management
      delete sendData.sourcePeerCasa;

      this.asyncEmit('property-changed', sendData);
      return true;
   }
   else {
      return false;
   }
}

Source.prototype.updateEvent = function(_modifiedEvent) {
   var eventIndex = this.getEventIndex(_modifiedEvent.name);

   if (eventIndex === -1) {
      return false;
   }

   if (this.deleteEvent(_modifiedEvent.name)) {
      return this.addEvent(_modifiedEvent);
   }
   else {
      return false;
   }
};

Source.prototype.addEvent = function(_event) {

   if (this.events.hasOwnProperty(_event.name)) {
      return false;
   }

   var eventObj = this.createChild(_event, "event", this);
   eventObj.coldStart(null);
   return true;
};

Source.prototype.deleteEvent = function(_eventName) {

   if (this.events.hasOwnProperty(_eventName)) {
      return false;
   }

   this.events[_eventName].aboutToBeDeleted();
   delete this.events[_eventName];
   return true;
};

// Called by stateproperty to take control based on setting a action property
Source.prototype.takeControl = function(_newController, _priority) {
   console.log(this.uName + ": Source.prototype.takeControl(): controller="+_newController.name+" priority="+_priority);
   var result = true;

   if (this.controller === null) {
      console.log(this.uName + ": Controller "+_newController.name+" is taking control");
      this.controller = _newController;
      this.controllerPriority = _priority;
   }
   else if (_newController != this.controller) {

      if (_priority >= this.controllerPriority) {
         console.log(this.uName + ": Controller "+_newController.name+" is taking control");
         var oldController = this.controller;
         var oldControllerPriority = this.controllerPriority;
         this.controller = _newController;
         this.controllerPriority = _priority;

         if (oldController) {
            console.log(this.uName + ": Old controller "+oldController.name+" is losing control");
            this.addSecondaryController(oldController, oldControllerPriority);
            oldController.ceasedToBeController(this.controller);
         }
      }
      else {
         console.log(this.uName + ": Controller "+_newController.name+" failed to take control from " + this.controller.name);
         console.log(this.uName + ": Controller "+_newController.name+" failed priority=" + _priority + " vs " + this.controller.name + " priority=" + this.controllerPriority);
         this.addSecondaryController(_newController, _priority);
         result = false;
      }
   }
   else {
      result = this.reprioritiseCurrentController(_priority);
   }

   return result;
};

// Called by stateproperty to realign control based on a state transition
// If it is the controller, check it still should be
// If it is not the controller and its priority than the controller, add or reassign
// priotity as a secondary controller
Source.prototype.updateControllerPriority = function(_controller, _newPriority) {

   if (_controller == this.controller) {
      this.reprioritiseCurrentController(_newPriority);
   }
   else if (_newPriority <= this.controllerPriority) {
      this.addSecondaryController(_controller, _newPriority);
   }
   // else do nothing as stateproperty will not take control with this method
   // control is only taken (via takeControl()) when actions are specified in a state
};

// Internal
Source.prototype.reprioritiseCurrentController = function(_newPriority) {
   var result = true;

   if (_newPriority != this.controllerPriority) {
      // Same controlling stateProperty but different priority - reassess if it still should be a controller
      console.log(this.uName + ": Existing controller "+this.controller.name+" is changing priority");

      if (this.secondaryControllers && (this.secondaryControllers.length > 0)) {

         if (_newPriority >= this.secondaryControllers[0].priority) {
            console.log(this.uName + ": Existing controller "+this.controller.name+" has retained control with new priority");
            this.controllerPriority = _newPriority;
         }
         else {
            console.log(this.uName + ": Controller "+this.controller.name+" is losing control");
            var losingController = this.controller;
            this.controllerPriority = this.secondaryControllers[0].priority;
            this.controller = this.secondaryControllers[0].controller;
            this.secondaryControllers.shift();
            this.addSecondaryController(losingController, _newPriority);
            losingController.ceasedToBeController(this.controller);
            this.controller.becomeController();
            result = false;
         }
      }
      else {
         console.log(this.uName + ": Existing controller "+this.controller.name+" has retained control with new priority");
         this.controllerPriority = _newPriority;
      }
   }

   return result;
};

// Internal
Source.prototype.addSecondaryController = function(_controller, _priority) {
   var placed = false;

   if (!this.secondaryControllers) {
      this.secondaryControllers = [];
   }

   // Make sure the controller is not already in the secondary controller list
   for (var i = 0; i < this.secondaryControllers.length; ++i) {

      if (this.secondaryControllers[i].controller == _controller) {
         this.secondaryControllers.splice(i, 1);
         break;
      }
   }

   // Place controller in the secondary controller list according to priority level
   for (var j = 0; j < this.secondaryControllers.length; ++j) {

      if (_priority >= this.secondaryControllers[j].priority) {
         this.secondaryControllers.splice(j, 0, { controller: _controller, priority: _priority });
         placed = true;
         break;
      }
   }

   if (!placed) this.secondaryControllers.push({ controller: _controller, priority: _priority });
};

Source.prototype.getMode = function() {
   return this.properties['MODE'].value;
};

Source.prototype.getManualMode = function() {
   return this.properties['MODE'].value === 'manual';
};

Source.prototype.setManualMode = function() {
   this.alignPropertyValue("MODE", "manual");
};

Source.prototype.getAutoMode = function() {
   return this.properties['MODE'].value === 'auto';
};

Source.prototype.setAutoMode = function() {
   this.alignPropertyValue("MODE", "auto");
};

//
// Called by SourceListener as a defined source has become valid again (available) - Not applicable for mirroring
//
Source.prototype.sourceIsValid = function(_data) {
};

//
// Called by SourceListener as a defined source has become invalid (unavailable) - Not applicable for mirroring
//
Source.prototype.sourceIsInvalid = function(_data) {
};

//
// Called by SourceListener as a defined source has changed it property value
// Only used when source is mirroring another source
//
Source.prototype.receivedEventFromSource = function(_data) {

   if (this.mirroring) {

      if (_data.propertyChange) {
         this.ensurePropertyExists(_data.name, "property", {}, this.config);
         this.alignPropertyValue(_data.name, _data.value);
      }
      else {
         this.raiseEvent(_data.name, _data);
      }
   }
};

Source.prototype.ensureEventExists = function(_eventName, _eventType, _config) {

   if (!this.events.hasOwnProperty(_eventName)) {
      _config.name = _eventName;
      _config.type = _eventType;
      _config.transient = true;
      this.createChild(_config, "event", this);
      return true;
   }
   return false;
};

module.exports = exports = Source;
 
