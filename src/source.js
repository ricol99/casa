var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Source(_config) {
   this.uName = _config.name;
   this.sName = this.uName.split(":")[1];
   this.valid = true;

   this.setMaxListeners(50);

   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   if (_config.secureConfig) {
      this.secureConfig = this.casaSys.loadSecureConfig(this.uName, _config);
   }

   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   this.manualOverrideTimeout = (_config.hasOwnProperty('manualOverrideTimeout')) ? _config.manualOverrideTimeout : 3600;
   this.controllerPriority = -1;
   this.props = {};
   
   if (_config.props) {
      var propLen = _config.props.length;

      for (var i = 0; i < propLen; ++i) {
         var Prop;

         if (_config.props[i].type == undefined) {
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
      this.events = _config.events;
   }

   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);

   this.ensurePropertyExists('MODE', 'stateproperty',
                             { "initialValue": 'auto',
                               "states": [ { name: "auto", priority: -100 },
                                           { name: "manual", priority: 100, timeout: { "duration": this.manualOverrideTimeout, "nextState": "auto" }}]},
                              _config);

   events.EventEmitter.call(this);

   if (this.casa) {
      console.log(this.uName + ': Source casa: ' + this.casa.uName);
      this.casa.addSource(this);
   }
}

util.inherits(Source, events.EventEmitter);

Source.prototype.getScheduleService = function() {
  var scheduleService =  this.casaSys.findService("scheduleservice");

  if (!scheduleService) {
     console.error(this.uName + ": ***** Schedule service not found! *************");
     process.exit();
   }

   return scheduleService;
};

Source.prototype.scheduledEventTriggered = function(_event) {

   if (_event.hasOwnProperty("ramp")) {
      console.error(this.uName + ": Ramps are not supported for this type of scheduled event");
      return;
   }

   if (_event.hasOwnProperty("name")) {
      this.raiseEvent(_event.name, { sourceName: this.uName, value: _event.value });
   }
};

Source.prototype.getRampService = function() {
  var rampService =  this.casaSys.findService("rampservice");

  if (!rampService) {
     console.error(this.uName + ": ***** Ramp service not found! *************");
     process.exit();
   }

   return rampService;
};

Source.prototype.isActive = function() {
   return this.props['ACTIVE'].value;
};

Source.prototype.isPropertyValid = function(_property) {

   if (this.props[_property] != undefined) {
      return this.props[_property].valid;
   }
   else {
      return true;
   }
};

Source.prototype.getProperty = function(_property) {
   return (this.props.hasOwnProperty(_property)) ? this.props[_property].value : undefined;
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

Source.prototype.getAllProperties = function(_allProps) {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = this.props[prop].value;
      }
   }
};


// Only called by ghost peer source
Source.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer (duplicate) source');

   var prop = this.props[_data.name];

   // Only update if the property has a different value
   if (prop && (prop.value != _data.value)) {

      // Only update if the property has no processing attached to it
      if (prop.type === 'property' && !prop.pipeline && !prop.hasSourceOutputValues) {
         return prop.set(_data.value, _data);
      }
   }
};

// Only called by ghost peer source - can cause duplicates! TODO
Source.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.uName + ': received event-raised event from peer (duplicate) source');
   this.raiseEvent(_data.uName, _data);
};

// Override this for last output hook - e.g. sync and external property with the final property value
Source.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
};

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
Source.prototype.emitPropertyChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Emitting Property Change (Child) ' + _propName + ' is ' + _propValue);
   console.info('Child Property Changed: ' + this.uName + ':' + _propName + ': ' + _propValue);

   var sendData = (_data) ? copyData(_data) : {};
   sendData.sourceName = this.uName;
   sendData.name = _propName;
   sendData.value = _propValue;
   sendData.local = this.local;
   this.emit('property-changed', sendData);
};

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
Source.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.props.hasOwnProperty(_propName)) {

      if ((!(_data && _data.coldStart)) && (_propValue === this.props[_propName].value)) {
         return true;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.props[_propName].value;
      var sendData = (_data) ? copyData(_data) : {};
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

      console.info('Property Changed: ' + this.uName + ':' + _propName + ': ' + _propValue);
      this.props[_propName].value = _propValue;
      this.props[_propName].previousValue = oldValue;
      sendData.alignWithParent = undefined;	// This should never be emitted - only for composite management
      this.emit('property-changed', sendData);
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
   console.log(this.uName + ": alignProperties() ", _properties);

   if (_properties && (_properties.length > 0)) {
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
         var ramp = copyData(_properties[i].ramp);

         if (_properties[i].ramp.hasOwnProperty("ramps")) {
            ramp.ramps = copyConfig(_properties[i].ramp.ramps);
         }

         this.propertyAlignmentQueue.push({ property: _properties[i].property, ramp: ramp });
      }
      else {
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

Source.prototype.rejectPropertyUpdate = function(_propName) {
   this.alignPropertyValue(_propName, this.props[_propName].value);
};

Source.prototype.ensurePropertyExists = function(_propName, _propType, _config, _mainConfig) {

   if (!this.props.hasOwnProperty(_propName)) {
      var loadPath =  ((_propType === 'property') || (_propType === 'stateproperty')) ? '' : 'properties/'
      var Prop = require('./' + loadPath + _propType);
      _config.name = _propName;
      _config.type = _propType;
      this.props[_propName]  = new Prop(_config, this);

      if (!_mainConfig.hasOwnProperty("props")) {
         _mainConfig.props = [ _config ];
      }
      else {
         _mainConfig.props.push(_config);
      }
   }
};

function copyConfig(_config) {

   if (_config instanceof Array) {
      var newConfig = [];

      for (var i = 0; i < _config.length; ++i) {
         newConfig.push(copyData(_config[i]));
      }
      return newConfig;
   }
   else {
      return copyData(_config);
   }
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

Source.prototype.goInvalid = function(_propName, _sourceData) {
   console.log(this.uName + ": Going invalid! Previously active state=" + this.props['ACTIVE'].value);

   if (this.alignmentTimeout) {
      clearTimeout(this.alignmentTimeout);
   }

   var sendData = _sourceData;
   sendData.sourceName = this.uName;
   sendData.oldState = this.props['ACTIVE'].value;
   this.props['ACTIVE'].value = false;	// XXX TODO Should this be setProperty()?
   sendData.name = _propName;
   console.log(this.uName + ": Emitting invalid!");
   this.emit('invalid', sendData);
}

Source.prototype.raiseEvent = function(_eventName, _data) {
   var sendData = (_data) ? copyData(_data) : {};
   sendData.sourceName = this.uName;
   sendData.name = _eventName;

   if (!sendData.hasOwnProperty("value")) {
      sendData.value = true;
   }

   console.log(this.uName + ": Emitting event " + _eventName);
   this.emit('event-raised', sendData);
}

Source.prototype.coldStart = function() {

   if (this.events) {
      this.scheduleService = this.getScheduleService();
      this.scheduleService.registerEvents(this, this.events);
   }

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.props[prop].coldStart();
      }
   }
}

Source.prototype.takeControl = function(_newController, _priority) {
   console.log(this.uName + ": Source.prototype.takeControl(): controller="+_newController.name+" priority="+_priority);
   var result = true;

   if (_newController != this.controller) {

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
         console.log(this.uName + ": Controller "+_newController.name+" failed to take control");
         this.addSecondaryController(_newController, _priority);
         result = false;
      }
   }
   else if (_priority != this.controllerPriority) {
      // Same controlling stateProperty but different priority - reassess if it still should be a controller
      console.log(this.uName + ": Existing controller "+this.controller.name+" is changing priority");

      if (this.secondaryControllers && (this.secondaryControllers.length > 0)) {

         if (_priority >= this.secondaryControllers[0].priority) {
            console.log(this.uName + ": Existing controller "+this.controller.name+" has retained control with new priority");
            this.controllerPriority = _priority;
         }
         else {
            console.log(this.uName + ": Controller "+this.controller.name+" is losing control");
            this.controllerPriority = this.secondaryControllers[0].priority;
            this.controller = this.secondaryControllers[0].controller;
            this.secondaryControllers.shift();
            this.addSecondaryController(_newController, _priority);
            _newController.ceasedToBeController(this.controller);
            this.controller.becomeController();
            result = false;
         }
      }
      else {
         console.log(this.uName + ": Existing controller "+this.controller.name+" has retained control with new priority");
         this.controllerPriority = _priority;
      }
   }

   return result;
};

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

Source.prototype.changeName = function(_newName) {
   this.casa.renameSource(this, _newName);
   this.uName = _newName;
}

module.exports = exports = Source;
 
