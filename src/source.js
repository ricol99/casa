var util = require('./util');
var SourceBase = require('./sourcebase');

function Source(_config, _owner) {
   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   SourceBase.call(this, _config, _owner);

   this.casa = this.gang.casa;
   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : 0;
   this.controllerPriority = -1;
   this.controller = null;

   if (_config.hasOwnProperty("subscription")) {
      _config.subscriptions = [ _config.subscription ];
   }

   if (_config.hasOwnProperty("subscriptions")) {

      for (var i = 0; i < _config.subscriptions.length; ++i) {
         this.ensurePropertyExists(_config.subscriptions[i].uName.substr(2).replace(/:/g, "-")+"-MODE", "property",
                                   { source: { uName: _config.subscriptions[i].uName, property: "MODE", subscription: _config.subscriptions[i].subscription }}, _config);
      }
   }

   if (_config.hasOwnProperty("mirrorSource")) {
      this.mirroring = true;
      var SourceListener = require('./sourcelistener');
      this.mirrorSourceListener = new SourceListener({ uName: _config.mirrorSource, listeningSource: this.uName, subscription: _config.mirrorSourceSubscription }, this);
   }

   this.createChildren(_config.properties, "property", this);
   this.createChildren(_config.events, "event", this);

   if (!this.properties.hasOwnProperty("MODE")) {
      this.createModeProperty(_config);
   }
   else {
      this.properties["MODE"].setPropagation({ ignoreParent: false, ignoreChildren: false, propagateToParent: true, propagateToChildren: true });
   }

   if (this.casa) {
      console.log(this.uName + ": Source casa: " + this.casa.uName)
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
};

Source.prototype.hotStart = function() {
   SourceBase.prototype.hotStart.call(this);
};

Source.prototype.createModeProperty = function(_config) {
   var modeConfig = { initialValue: "auto", ignoreParent: false, ignoreChildren: false, propagateToParent: true, propagateToChildren: true, takeControlOnTransition: true, ignoreControl: true,
                      states: [ { name: "auto", priority: -100, action: { property: "MANUAL-MODE-DURATION", value: -1 },
                                  source: { property: "MANUAL-MODE-DURATION", guard: { property: "MANUAL-MODE-DURATION", value: -1, invert: true }, nextState: "manual" }},
                                { name: "manual", priority: 100,
                                  timeout: { source: { property: "MANUAL-MODE-DURATION" }, action: { property: "MANUAL-MODE-DURATION", value: -1 }, nextState: "auto" }}]};

   if (_config.hasOwnProperty("modes")) {

      for (var i = 0; i < _config.modes.length; ++i) {
         let mode = _config.modes[i];
         modeConfig.states.push({ name: mode.name, priority: mode.hasOwnProperty("priority") ? mode.priority : 100 });

         let timeout = mode.hasOwnProperty("timeout") ? mode.timeout : -1;
         this.ensurePropertyExists(mode.name.toUpperCase()+"-MODE-DURATION", "property", { ignoreParent: false, ignoreChildren: false, propagateToParent: true,
                                                                                           propagateToChildren: true, initialValue: timeout }, _config);

         modeConfig.states[modeConfig.states.length - 1].timeout = { source: { property: mode.name.toUpperCase()+"-MODE-DURATION" }, nextState: "auto" };

         if (mode.hasOwnProperty("action")) {
            mode.actions = [ mode.action ];
         }

         if (mode.hasOwnProperty("actions")) {
            modeConfig.states[modeConfig.states.length - 1].actions = mode.actions;
         }
      }
   }

   if (_config.hasOwnProperty("modeSource")) {
      modeConfig.source = _config.modeSource;
   }

   this.ensurePropertyExists("MANUAL-MODE-DURATION", "property",
                            { ignoreParent: false, propagateToParent: true, initialValue: _config.hasOwnProperty('manualOverrideTimeout') ? _config.manualOverrideTimeout : -1 }, _config);

   this.ensurePropertyExists("MODE", "stateproperty", modeConfig, _config);
};

Source.prototype.refreshSourceListeners  = function() {
         
   if (this.hasOwnProperty("sourceListeners")) {
   
      for (var sourceListenerName in this.sourceListeners) {

         if (this.sourceListeners.hasOwnProperty(sourceListenerName)) {
            this.sourceListeners[sourceListenerName].refreshSource();
         }
      }
   }
   
   for (var propertyName in this.properties) {

      if (this.properties.hasOwnProperty(propertyName)) {
         this.properties[propertyName].refreshSourceListeners();
      }
   }

   for (var eventName in this.events) {

      if (this.events.hasOwnProperty(eventName)) {
         this.events[eventName].refreshSourceListeners();
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
   this.newScheduledTransaction();

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
};

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
Source.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.properties.hasOwnProperty(_propName)) {
      console.log(this.uName + ": updateProperty prop="+_propName+" value="+_propValue);

      var updateProp = (_data && _data.hasOwnProperty("coldStart") && _data.coldStart) ||
                       (this.properties[_propName].alwaysUpdate()) ||
                       (_propValue !== this.properties[_propName].value);

      if (!updateProp) {
      //if ((!(_data && _data.hasOwnProperty("coldStart") && _data.coldStart)) && (_propValue === this.properties[_propName].value)) {
         return _propValue;
      }


      var oldValue = this.properties[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName =  this.uName;
      sendData.name = _propName;
      sendData.propertyOldValue = oldValue;

      if (!sendData.hasOwnProperty("transaction")) {
         sendData.transaction = this.checkTransaction();
      }
      else {
         this.currentTransaction = sendData.transaction;
      }

      if (this.local) {
         sendData.local = true;
      }

      // Call the final hooks
      var newPropValue = this.properties[_propName].propertyAboutToChange(_propValue, _data);
      sendData.value = newPropValue;;

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + newPropValue);

      this.propertyAboutToChange(_propName, newPropValue, _data);

      if (this.capturingAllEvents && this.mirrorSourceListener.isValid() && this.mirrorSourceListener.getSource().hasProperty(_propName)) {

         if (this.mirrorSourceListener.getSource().getProperty(_propName) != newPropValue) {
            this.mirrorSourceListener.getSource().alignPropertyValue(_propName, newPropValue);
         }
      }

      console.info(this.uName + ': Property Changed: ' + _propName + ': ' + newPropValue, this.bowing ? "(BOWING)" : "");
      this.properties[_propName]._actuallySetPropertyValue(newPropValue, _data);

      if (sendData.hasOwnProperty("priority")) {
         _data.priority = sendData.priority;
      }

      delete sendData.alignWithParent;	// This should never be emitted - only for composite management
      delete sendData.sourcePeerCasa;
      //console.error(JSON.stringify(sendData));
      this.casa.eventLogger.logRaisedEvent(sendData);

      this.asyncEmit('property-changed', sendData);
      return newPropValue;
   }
   else {
      return _propValue;
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

// Called by stateproperty to check whether it can take control based on setting a action property
Source.prototype.checkControl = function(_newController, _priority) {
   console.log(this.uName + ": Source.prototype.checkControl(): controller="+_newController.name+" priority="+_priority);
   return this.controller ? ((_newController != this.controller) ? (_priority >= this.controllerPriority) : true) : true;
};

// Called by stateproperty to take control based on setting a action property
Source.prototype.takeControl = function(_newController, _priority, _override) {
   console.log(this.uName + ": Source.prototype.takeControl(): controller="+_newController.name+" priority="+_priority);
   var result = true;
   var override = (_override === undefined) ? false : _override;

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

   return override || result;
};

// Called by stateproperty to realign control based on a state transition
// If it is the controller, check it still should be
// If it is not the controller and its priority than the controller, add or reassign
// priotity as a secondary controller
Source.prototype.updateControllerPriority = function(_controller, _newPriority) {

   if (_controller === this.controller) {
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
            console.log(this.uName + ": Controller "+this.controller.name+" is losing control to "+this.secondaryControllers[0].controller.name);
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

      if ((this.secondaryControllers[i].controller === _controller) || (this.secondaryControllers[i].controller === this.controller)) {
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

Source.prototype.setManualMode = function(_duration) {

   if (this.getProperty("MODE") !== "manual") {

      if (_duration !== undefined) {
         this.alignPropertyValue("MANUAL-MODE-DURATION", _duration);
      }
      else {
         this.alignPropertyValue("MODE", "manual");
      }
   }
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

module.exports = exports = Source;
 
