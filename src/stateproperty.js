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
   this.priority = (_config.hasOwnProperty("priority")) ? _config.priority : 0;
   this.currentPriority = this.priority;

   for (var i = 0; i < _config.states.length; ++i) {
      this.states[_config.states[i].name] = new State(_config.states[i], this);
   }
}

util.inherits(StateProperty, Property);

StateProperty.prototype.coldStart = function(_data) {
   this.setState(this.value);
   Property.prototype.coldStart.call(this, _data);
};
   
StateProperty.prototype.getRampService = function() {

   if (!this.rampService) {
      this.rampService =  this.casaSys.findService("rampservice");

      if (!this.rampService) {
         console.error(this.uName + ": ***** Ramp service not found! *************");
         process.exit();
      }
   }

   return this.rampService;
}

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

      if (currentState && (source.nextState === currentState.name)) {
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
   var immediateState = null;

   switch (_nextState) {
      case "PREVIOUS-STATE":
         nextState = this.previousState;
         break;
   }

   if (this.states[nextState]) {

      for (var i = 0; i < 10; ++i) {
         immediateNextState = null;

         if (this.states[nextState]) {
            immediateNextState = this.states[nextState].checkSourceProperties();

            if (!immediateNextState) {
               break;
            }
            else {
               nextState = immediateNextState;
            }
         }
         else {
            break;
         }
      }

      if (immediateNextState) {
         console.error(this.uName + ": State machine is broken as state model has gone through 10 immediate state transitions");
         process.exit(3);
      }
   }

   return nextState;
}

StateProperty.prototype.setState = function(_nextState) {
   console.log(this.uName+": setState state="+_nextState);

   this.clearStateTimer();
   this.previousState = this.value;

   if (!this.cold) {

      if (this.states[this.value]) {
         this.states[this.value].exiting();
      }
      else if (this.states["DEFAULT"] && this.states[_nextState]) {
         this.states["DEFAULT"].exiting();
      }
   }

   var state = (this.states[_nextState]) ? this.states[_nextState] : this.states["DEFAULT"];

   if (state) {
      var immediateNextState = state.initialise();

      if (immediateNextState) {

         setTimeout(function(_this, _nextState) {
            _this.set(_this.transformNextState(_nextState), { sourceName: _this.owner });
         }, 1, this, immediateNextState);
      }
      else {
         this.setStateTimer(state);
      }
   }
};

StateProperty.prototype.alignTargetProperty = function(_propName, _propValue, _priority) {
   this.alignTargetProperties([{ property: _propName, value: _propValue }], _priority);
};

StateProperty.prototype.alignTargetProperties = function(_targets, _priority) {
   this.currentPriority = _priority;

   if (this.targetPropsBuffer) {
      delete this.targetPropsBuffer;
   }

   this.targetPropsBuffer = {};

   if (this.owner.takeControl(this, this.currentPriority)) {
      this.owner.alignProperties(_targets);
   }
   else {
      this.bufferAlignProperties(_targets, this.currentPriority);
   }
};

StateProperty.prototype.bufferAlignProperties = function(_targets, _priority) {

   if (this.targetPropsBuffer) {
      delete this.targetPropsBuffer;
   }

   this.targetPropsBuffer = {};
   this.targetPropsPriority = _priority;
   
   for (var i = 0; i < _targets.length; ++i) {
      this.targetPropsBuffer[_targets[i].property] = _targets[i].value;
   }

}; 

StateProperty.prototype.applyBufferedAlignProperties = function() {
   var targets = [];

   for (var targetProp in this.targetPropsBuffer) {

      if (this.targetPropsBuffer.hasOwnProperty(targetProp)) {
         targets.push({ property: targetProp, value: this.targetPropsBuffer[targetProp] });
      }
   }

   if (targets.length > 0) {
      this.alignTargetProperties(targets, this.targetPropsPriority);
   }
};

StateProperty.prototype.becomeController = function() {
   // I am now the controller
   this.controllingOwner = true;

   // Empty any buffered target alignments
   this.applyBufferedAlignProperties();

   // Re-apply current state
   if (this.states[this.value]) {
      this.states[this.value].alignTargets();
   }
};

StateProperty.prototype.ceasedToBeController = function(_newController) {
   this.controllingOwner = false;
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
   this.ramps = [];

   if (_config.hasOwnProperty("source")) {
      _config.sources = [ _config.source ];
   }

   this.priority = _config.hasOwnProperty("priority") ? _config.priority : _owner.priority;
   this.sources = _config.hasOwnProperty("sources") ? _config.sources :(_config.hasOwnProperty("source") ? [ _config.source ] : undefined);
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

      // TBD XXX Currently ignoring return value. Should I use it to determine which state we are in mulitple schedules?
      // Could use state timeout + schedule to do this, may not work though
      this.scheduleService.registerEvents(this, this.schedules);
   }
}

State.prototype.initialise = function() {
   var newImmediateState = this.checkSourceProperties();

   if (!newImmediateState) {
      this.alignTargets();
   } 
   else {
      console.log(this.uName + ": Initialise() ImmediateState state transfer to " + newImmediateState);
   }

   return newImmediateState;
};

State.prototype.alignTargets = function() {
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
            this.createRamp(rampConfig);
         }
      }
   }

   this.owner.alignTargetProperties(targets, this.priority);
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

State.prototype.exiting = function(_event, _value) {

   for (var i = 0; i < this.ramps.length; ++i) {
      this.ramps[i].cancel();
   }
   this.ramps = [];
};

State.prototype.createRamp = function(_config) {
   var ramp = this.owner.getRampService().createRamp(this, _config);
   this.ramps.push(ramp);
   ramp.start();
};

State.prototype.scheduledEventTriggered = function(_event, _value) {
   this.owner.owner.raiseEvent(_event.name, { sourceName: this.uName, value: _value });
   this.owner.set(this.name, { sourceName: this.owner.owner });
}

State.prototype.newValueFromRamp = function(_ramp, _config, _value) {
   console.log(this.uName + ": New value from ramp, property=" + _config.property + ", value=" + _value);
   this.owner.alignTargetProperty(_config.property, _value, _config.propertyPriority);
};

State.prototype.rampComplete = function(_ramp, _config) {

   for (var i = 0; i < this.ramps.length; ++i) {

      if (this.ramps === _ramp) {
         this.splice(i, 1)
         break;
      }
   }
};

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
