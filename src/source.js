var util = require('./util');
var SourceBase = require('./sourcebase');

function Source(_config) {
   SourceBase.call(this);
   this.config = _config;
   this.uName = _config.uName;
   this.sName = this.uName.split(":")[1];

   //this.setMaxListeners(50);

   this.casa = this.gang.casa;
   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : 0;
   this.manualOverrideTimeout = (_config.hasOwnProperty('manualOverrideTimeout')) ? _config.manualOverrideTimeout : 3600;
   this.controllerPriority = -1;
   this.controller = null;
   
   if (_config.props) {
      var propLen = _config.props.length;

      for (var i = 0; i < propLen; ++i) {
         var Prop;

         if (!_config.props[i].hasOwnProperty('type')) {
            _config.props[i].type = 'property';
         }

         if ((_config.props[i].type == "property") || (_config.props[i].type == "stateproperty")) {
            Prop = require('./'+_config.props[i].type);
         }
         else {
            Prop = require('./properties/'+_config.props[i].type);
         }

         this.props[_config.props[i].name] = new Prop(_config.props[i], this);
      }
   }

   if (_config.events) {
      this.events = util.copy(_config.events, true);
   }

   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);

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

Source.prototype.getScheduleService = function() {
  var scheduleService =  this.gang.findService("scheduleservice");

  if (!scheduleService) {
     console.error(this.uName + ": ***** Schedule service not found! *************");
     process.exit(3);
   }

   return scheduleService;
};

Source.prototype.scheduledEventTriggered = function(_event) {

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
  var rampService =  this.gang.findService("rampservice");

  if (!rampService) {
     console.error(this.uName + ": ***** Ramp service not found! *************");
     process.exit(3);
   }

   return rampService;
};

Source.prototype.setProperty = function(_propName, _propValue, _data) {

   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ' + _propValue);

   if (this.props.hasOwnProperty(_propName)) {
      return this.props[_propName].set(_propValue, _data);
   }
   else {
      return false;
   } 
};

Source.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ramp');

   if (this.props.hasOwnProperty(_propName)) {
      return this.props[_propName].setWithRamp(_ramp, _data);
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
   console.log(this.uName + ": updateProperty prop="+_propName+" value="+_propValue);

   if (this.props.hasOwnProperty(_propName)) {

      if ((!(_data && _data.coldStart)) && (_propValue === this.props[_propName].value)) {
         return true;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.props[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName = this.uName;
      sendData.name = _propName;
      sendData.propertyOldValue = oldValue;
      sendData.value = _propValue;

      if (this.hasOwnProperty('local')) {
         sendData.local = this.local;
      }

      // Call the final hooks
      this.props[_propName].propertyAboutToChange(_propValue, sendData);
      this.propertyAboutToChange(_propName, _propValue, sendData);

      console.info(this.uName + ': Property Changed: ' + _propName + ': ' + _propValue);
      this.props[_propName].value = _propValue;
      this.props[_propName].previousValue = oldValue;

      delete sendData.alignWithParent;	// This should never be emitted - only for composite management
      delete sendData.sourcePeerCasa;

      this.asyncEmit('property-changed', sendData);
      return true;
   }
   else {
      return false;
   }
}

Source.prototype.alignPropertyRamp = function(_propName, _rampConfig) {
   this.alignProperties([ { property: _propName, ramp: _rampConfig } ]);
};

Source.prototype.alignPropertyValue = function(_propName, _nextPropValue) {
   this.alignProperties([ { property: _propName, value: _nextPropValue } ]);
};

Source.prototype.alignProperties = function(_properties) {

   if (_properties && (_properties.length > 0)) {
      console.log(this.uName + ": alignProperties() ", _properties.length);
      this.addPropertiesForAlignment(_properties);
      this.alignNextProperty();
   }
};

// Internal
Source.prototype.addPropertiesForAlignment = function(_properties) {

   if (!this.propertyAlignmentQueue) {
      this.propertyAlignmentQueue = [];
   }

   for (var i = 0; i < _properties.length; ++i) {

      if (_properties[i].hasOwnProperty("ramp")) {
         var ramp = util.copy(_properties[i].ramp);

         if (_properties[i].ramp.hasOwnProperty("ramps")) {
            ramp.ramps = util.copy(_properties[i].ramp.ramps, true);
         }

         this.propertyAlignmentQueue.push({ property: _properties[i].property, ramp: ramp });
      }
      else {
         console.log(this.uName + ": addPropertyForAlignment() property=" + _properties[i].property + " value=" + _properties[i].value);
         this.propertyAlignmentQueue.push({ property: _properties[i].property, value: _properties[i].value });
      }
   }
};

// Internal
Source.prototype.alignNextProperty = function() {

   if (!this.alignmentTimeout && (this.propertyAlignmentQueue.length > 0)) {

      this.alignmentTimeout = setTimeout( () => {
         this.alignmentTimeout = null;

         if (this.propertyAlignmentQueue.length > 0) {
            var prop = this.propertyAlignmentQueue.shift();

            if (prop.hasOwnProperty("ramp")) {
               console.log(this.uName + ": Setting property " + prop.property + " to ramp");
               this.setPropertyWithRamp(prop.property, prop.ramp, { sourceName: this.uName });
            }
            else {
               console.log(this.uName + ": Setting property " + prop.property + " to value " + prop.value);
               this.setProperty(prop.property, prop.value, { sourceName: this.uName });
            }
            this.alignNextProperty();
         }
         else {
            console.error(this.uName + ": Something has gone wrong as no alignments are in the queue!");
         }
      }, 1);
   }
};

Source.prototype.goInvalid = function(_propName, _sourceData) {
   console.log(this.uName + ": Property " + _propName + " going invalid! Previously active state=" + this.props[_propName].value);

   if (this.alignmentTimeout) {
      clearTimeout(this.alignmentTimeout);
   }

   var sendData = _sourceData;
   sendData.sourceName = this.uName;
   sendData.oldState = this.props[_propName].value;
   sendData.name = _propName;
   console.log(this.uName + ": Emitting invalid!");

   this.emit('invalid', sendData);
}

Source.prototype.updateEvent = function(_modifiedEvent) {
   var eventIndex = this.getEventIndex(_eventName);

   if (eventIndex === -1) {
      return false;
   }

   for (var prop in _modifiedEvent) {

      if (_modifiedEvent.hasOwnProperty(prop)) {
         this.events[eventIndex][prop] = _modifiedEvent[prop];
      }
   }

   if (this.deleteEvent(_modifiedEvent.name)) {
      this.addEvent(this.events[eventIndex]);
      return true;
   }
   else {
      return false;
   }
};

Source.prototype.addEvent = function(_event) {
   this.events.push(_event);
   this.scheduleService.addEvent(this, _event);
};

Source.prototype.getEventIndex = function(_eventName) {
   var eventIndex = -1;

   for (var i = 0; i < this.events.length; ++i) {
      if (this.events[i].name = _eventName) {
         eventIndex = i;
         break;
      }
   }

   return eventIndex;
};

Source.prototype.deleteEvent = function(_eventName) {

   var eventIndex = this.getEventIndex(_eventName);

   if (eventIndex === -1) {
      return false;
   }

   this.events.splice(eventNumber, 1);
   this.scheduleService.removeEvent(this, _eventName);
   return true;
};

Source.prototype.coldStart = function() {

   if (this.events) {
      this.scheduleService = this.getScheduleService();
      this.scheduleService.registerEvents(this, this.events);
   }

   SourceBase.prototype.coldStart.call(this);
}

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
   return this.props['MODE'].value;
};

Source.prototype.getManualMode = function() {
   return this.props['MODE'].value === 'manual';
};

Source.prototype.setManualMode = function() {
   this.alignPropertyValue("MODE", "manual");
};

Source.prototype.getAutoMode = function() {
   return this.props['MODE'].value === 'auto';
};

Source.prototype.setAutoMode = function() {
   this.alignPropertyValue("MODE", "auto");
};

module.exports = exports = Source;
 
