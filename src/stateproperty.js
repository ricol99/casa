var util = require('util');
var Property = require('./property');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);
   this.casaSys = CasaSystem.mainInstance();

   this.states = {};
   this.targetPropsBuffer = {};
   this.controllingOwner = false;
   this.assignedPriority = (_config.hasOwnProperty("priority")) ? _config.priority : 0;
   this.currentPriority = this.assignedPriority;

   for (var i = 0; i < _config.states.length; ++i) {
      this.states[_config.states[i].name] = new State(_config.states[i], this);
   }
}

util.inherits(StateProperty, Property);

StateProperty.prototype.coldStart = function(_data) {
   this.setState(this.value);
   Property.prototype.coldStart.call(this, _data);
};

StateProperty.prototype.propertyAboutToChange = function(_propertyValue, _data) {
   console.log(this.uName + ": state about to change to " + _propertyValue);
   this.setState(_propertyValue);
};

StateProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName + ": Event received when in state " + this.value);

   var propertyValue = _data.value;
   var currentState = this.states[this.value];
   var source = null;

   if (!this.sourceListeners[_sourceListener.sourceEventName]) {
      console.log(this.uName + ": Event received from sourcelistener that is not recognised! " + _sourceListener.sourceEventName);
      return;
   }


   if (currentState && currentState.sourceMap[_sourceListener.sourceEventName]) {
      source = (currentState.sourceMap[_sourceListener.sourceEventName][propertyValue]) ?
                  currentState.sourceMap[_sourceListener.sourceEventName][propertyValue] :
                  currentState.sourceMap[_sourceListener.sourceEventName]["DEFAULT_VALUE"];
   }

   if (!source && this.states["DEFAULT"] && this.states["DEFAULT"].sourceMap[_data.sourceEventName]) {
      source = (this.states["DEFAULT"].sourceMap[_sourceListener.sourceEventName][propertyValue]) ?
                  this.states["DEFAULT"].sourceMap[_sourceListener.sourceEventName][propertyValue] :
                  this.states["DEFAULT"].sourceMap[_sourceListener.sourceEventName]["DEFAULT_VALUE"];
   }

   if (source && source.hasOwnProperty("nextState")) {

      if (currentState && (source.nextState.name === currentState.name)) {XXX
         this.resetStateTimer(currentState);
      }
      else {
         this.set(this.transformNextState(source.nextState), { sourceName: this.owner });
      }
   }
};

StateProperty.prototype.resetStateTimer = function(_state) {
   this.clearStateTimer();
   this.setStateTimer(_state);
};

StateProperty.prototype.clearStateTimer = function() {
   
   if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
   }
};

StateProperty.prototype.setStateTimer = function(_state) {

   if (_state.timeout) {

      this.stateTimer = setTimeout(function(_this, _timeoutState) {
         _this.stateTimer = null;
         _this.set(_this.transformNextState(_timeoutState), { sourceName: _this.owner });
      }, _state.timeout.duration * 1000, this, _state.timeout.nextState);
   }
};

StateProperty.prototype.transformNextState = function(_nextState) {
   var nextState = _nextState;

   switch (_nextState) {
      case "PREVIOUS-STATE":
         nextState = this.previousState;
         break;
   }

   return nextState;
}

StateProperty.prototype.setState = function(_nextState) {
   console.log(this.uName+": setState state="+_nextState);

   this.clearStateTimer();
   this.previousState = this.value;

   if (this.states[_nextState]) {
      this.setStateTimer(this.states[_nextState]);
      var immediateNextState = this.states[_nextState].initialise();

      if (immediateNextState) {

         setTimeout(function(_this, _nextState) {
            _this.set(_this.transformNextState(_nextState), { sourceName: _this.owner });
         }, 100, this, immediateNextState);
      }
   }
   else if (this.states["DEFAULT"]) {
      this.states["DEFAULT"].alignTargetProperties();
   }
};

StateProperty.prototype.createRamp = function(_config) {

   if (!this.rampService) {
      this.rampService =  this.casaSys.findService("rampservice");

      if (!this.rampService) {
         console.error(this.uName + ": ***** Ramp service not found! *************");
         process.exit();
      }
   }

   var ramp = this.rampService.createRamp(this, _config);
   ramp.start();
};

StateProperty.prototype.alignProperty = function(_propName, _propValue, _priority) {
   this.alignProperties([{ property: _propName, value: _propValue }], _priority);
};

StateProperty.prototype.alignProperties = function(_targets, _priority) {
   this.currentPriority = (_priority === undefined) ? this.assignedPriority : _priority;
   this.targetPropsBuffer = {};

   if (this.owner.takeControl(this, this.currentPriority)) {
      this.owner.setNextProperties(_targets);
   }
   else {
      this.bufferAlignProperties(_targets, this.currentPriority);
   }
};

StateProperty.prototype.bufferAlignProperties = function(_targets, _priority) {
   this.targetPropsBuffer = {};
   
   for (var i = 0; i < _targets.length; ++i) {
      this.targetPropsBuffer[_targets[i].property] = _targets[i].value;
      this.targetPropsPriority = _priority;
   }
}; 

StateProperty.prototype.applyBufferedAlignProperties = function() {
   var targets = [];

   for (var targetProp in this.targetPropsBuffer) {

      if (this.targetPropsBuffer.hasOwnProperty(targetProp)) {
         targets.push({ property: targetProp, value: this.targetPropsBuffer[targetProp] });
      }
   }

   this.alignProperties(targets, this.targetPropsPriority);
};

StateProperty.prototype.newValueFromRamp = function(_ramp, _config, _value) {
   this.alignProperty(_config.property, _value, _config.propertyPriority);
};

// Override super method in Property and do nothing
StateProperty.prototype.setManualMode = function(_manualMode) {

   if (!_manualMode) {
      this.applyBufferedAlignProperties();
   }
};

StateProperty.prototype.becomeController = function() {
   this.controllingOwner = true;
   this.applyBufferedAlignProperties();
};

StateProperty.prototype.ceasedToBeController = function(_newController) {
   this.controllingOwner = false;
};

StateProperty.prototype.rampComplete = function(_ramp, _config) {
   // DO NOTHING
};

StateProperty.prototype.sourceIsValid = function(_data) {
};

StateProperty.prototype.sourceIsInvalid = function(_data) {
};

StateProperty.prototype.fetchOrCreateSourceListener = function(_config) {
   var sourceListenerName = _config.name + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event);
   var sourceListener = this.sourceListeners[sourceListenerName];

   if (!sourceListener) {
      _config.uName = _config.name;
      sourceListener = new SourceListener(_config, this);
      this.sourceListeners[sourceListenerName] = sourceListener;
   }

   return sourceListener;
};

function State(_config, _owner) {
   this.name = _config.name;
   this.owner = _owner;
   this.uName = _owner.uName + ":state:" + this.name;
   this.sourceMap = {};

   if (_config.hasOwnProperty("source")) {
      _config.sources = [ _config.source ];
   }

   this.priority = _config.hasOwnProperty("priority") ? _config.priority : 0;
   this.sources = _config.sources;
   this.targets = _config.hasOwnProperty("targets") ? _config.targets : (_config.hasOwnProperty("target") ? [ _config.target ] : undefined);
   this.schedules = _config.hasOwnProperty("schedules") ? _config.schedules : (_config.hasOwnProperty("schedule") ? [ _config.schedule ] : undefined);
   this.timeout = _config.timeout;

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (!this.sources[i].hasOwnProperty("name")) {
            this.sources[i].name = this.owner.owner.uName;
         }

         var sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i]);
         this.sources[i].sourceListener = sourceListener;
         var val = this.sources[i].hasOwnProperty("value") ? this.sources[i].value : "DEFAULT_VALUE";

         if (!this.sourceMap[sourceListener.sourceEventName]) {
            this.sourceMap[sourceListener.sourceEventName] = {};
         }

         this.sourceMap[sourceListener.sourceEventName][val] = this.sources[i];
      }
   }

   if (this.schedules) {

      if (!this.scheduleService) {
         this.scheduleService =  this.owner.casaSys.findService("scheduleservice");
      }

      if (!this.scheduleService) {
         console.error(this.uName + ": ***** Schedule service not found! *************");
         process.exit();
      }

      this.scheduleService.registerEvents(this, this.schedules);
   }
}

State.prototype.initialise = function() {
   var newImmediateState = this.checkSourceProperties();

   if (!newImmediateState) {
      this.alignTargetProperties();
   } 
   else {
      console.log(this.uName + ": Initialise() ImmediateState state transfer to " + newImmediateState);
   }

   return newImmediateState;
};

State.prototype.alignTargetProperties = function() {
   var targets = [];

   if (this.targets) {

      for (var i = 0; i < this.targets.length; ++i) {

         if (this.targets[i].hasOwnProperty("value")) {
            targets.push(this.targets[i]);
         }
         else if (this.targets[i].hasOwnProperty("ramp")) {

            var rampConfig = copyObject(this.targets[i].ramp);

            if (!(rampConfig.hasOwnProperty("startValue"))) {
               rampConfig.startValue = this.owner.owner.props[this.targets[i].property].value;
            }

            rampConfig.property = this.targets[i].property;
            rampConfig.propertyPriority = this.priority;
            this.owner.createRamp(rampConfig);
         }
      }
   }

   this.owner.alignProperties(targets, this.priority);
};

State.prototype.checkSourceProperties = function() {
   var immediateNextState = null;

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (this.sources[i].hasOwnProperty("value") && this.sources[i].hasOwnProperty("property")) {
            var sourceName = this.sources[i].hasOwnProperty("name") ? this.sources[i].name : this.owner.owner.uName;
            var sourceEventName = sourceName + ":" + this.sources[i].property;
            var sourceListener = this.owner.sourceListeners[sourceEventName];
            var source = (sourceListener) ? sourceListener.getSource() : null;

            if (source && source.getProperty(this.sources[i].property) === this.sources[i].value) {

               // Property already matches so move to next state immediately
               if (this.sources[i].hasOwnProperty("nextState") && (this.sources[i].nextState !== this.name)) {
                  immediateNextState = this.sources[i].nextState;
                  break;
               }
            }
         }
      }
   }

   return immediateNextState;
};

State.prototype.scheduledEventTriggered = function(_event, _value) {
   this.owner.owner.raiseEvent(_event.name, { sourceName: this.uName, value: _value });
   this.owner.set(this.name, { sourceName: this.owner.owner });
}

State.prototype.getRampStartValue = function(_event) {
   return 0;
}

function copyObject(_sourceObject) {
   var newObject = {};

   for (var prop in _sourceObject) {

      if (_sourceObject.hasOwnProperty(prop)){
         newObject[prop] = _sourceObject[prop];
      }
   }

   return newObject;
}

module.exports = exports = StateProperty;
