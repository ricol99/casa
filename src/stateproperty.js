var util = require('util');
var Property = require('./property');
var SourceListener = require('./sourcelistener');
var Gang = require('./gang');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.states = {};
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
   var res = this.clearStateTimer();
   this.setStateTimer(_state, res);
};

StateProperty.prototype.clearStateTimer = function() {
   var result = { timerActive: false };
   
   if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      result.timerActive = true;
      result.timeLeft = this.timeoutDuration + this.timerStartedAt - Date.now();
      this.timerStartedAt = 0;
      this.stateTimer = null;
   }

   return result;
};

StateProperty.prototype.setStateTimer = function(_state, _timeoutDuration) {

   if (_state.hasOwnProperty('timeout')) {

      if (_state.timeout.inheritsFrom[this.states[this.value]]) {

         if (_timeoutDuration == undefined) {

            if (_state.timeout.hasOwnProperty('duration')) {
               this.timeoutDuration = _state.timeout.duration * 1000;
            }
            else {
               return;
            }
         }
         else if (_state.timeout.hasOwnProperty('duration')) {
            this.timeoutDuration = (_timeoutDuration < _state.timeout.duration * 1000) ? _timeoutDuration : _state.timeout.duration * 1000;
         }
         else {
            this.timeoutDuration = _timeoutDuration;
         }

         if (_state.timeout.hasOwnProperty('nextState')) {
            this.timeoutNextState = _state.timeout.nextState;
         }
      }
      else if (_state.timeout.hasOwnProperty('duration')) {
         this.timeoutDuration = _state.timeout.duration * 1000;
         this.timeoutNextState = _state.timeout.nextState;
      }
      else {
         return;
      }

      this.timerStartedAt = Date.now();
      this.stateTimer = setTimeout(StateProperty.prototype.timeoutInternal.bind(this), this.timeoutDuration, this.timeoutNextState);
   }
};

StateProperty.prototype.timeoutInternal = function(_timeoutState) {
   this.stateTimer = null;
   this.set(this.transformNextState(_timeoutState), { sourceName: this.owner });
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

StateProperty.prototype.setState = function(_nextStateName) {
   console.log(this.uName+": setState state="+_nextStateName);
   this.previousState = this.value;

   var clearTimerResult = this.clearStateTimer();

   if (clearTimerResult.timerActive && (clearTimerResult.timeLeft <= 0) && this.states[this.value].hasOwnProperty('timeout')) {
      // Edge case where the timeout has already expired and waiting for the event loop to schedule. We have just cancelled it
      // We should call the timeout code straight away in the current state, not reset the timer and enter the new state
      console.log(this.uName + ": Edge case - previous state timer has already expired and is waiting to be scheduled, call the timeout code manually");
      setTimeout(StateProperty.prototype.timeoutInternal.bind(this), 1, this.states[this.value].timeout.nextState);
      return;
   }

   if (!this.cold) {

      if (this.states[this.value]) {
         this.states[this.value].exiting();
      }
      else if (this.states["DEFAULT"] && this.states[_nextStateName]) {
         this.states["DEFAULT"].exiting();
      }
   }

   var nextState = (this.states[_nextStateName]) ? this.states[_nextStateName] : this.states["DEFAULT"];

   if (nextState) {
      var immediateNextState = nextState.initialise();

      if (immediateNextState) {
         console.log(this.uName + ": Initialise() ImmediateState state transfer to " + newImmediateState);

         setTimeout( (_nextStateName) => {
            this.set(_nextStateName, { sourceName: this.owner });
         }, 1, this.transformNextState(immediateNextState));
      }

      this.setStateTimer(nextState, clearTimerResult.timeLeft);
   }
};

StateProperty.prototype.alignTargetProperty = function(_propName, _propValue, _priority) {
   this.alignTargetProperties([{ property: _propName, value: _propValue }], _priority);
};

StateProperty.prototype.alignTargetProperties = function(_targets, _priority) {
   this.currentPriority = _priority;

   if (this.owner.takeControl(this, this.currentPriority) && _targets) {
      this.owner.alignProperties(_targets);
   }
};

StateProperty.prototype.becomeController = function() {
   // I am now the controller
   this.controllingOwner = true;

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
   var sourceListenerName = _config.uName + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event);
   var sourceListener = this.sourceListeners[sourceListenerName];

   if (!sourceListener) {
      _config.uName = _config.uName;
      sourceListener = new SourceListener(_config, this);
      this.sourceListeners[sourceListenerName] = sourceListener;
   }

   return sourceListener;
};

function State(_config, _owner) {
   this.name = _config.name;
   this.owner = _owner;
   this.uName = _owner.uName + ":state:" + this.name;
   this._id = this.uName;
   this.sourceMap = {};

   if (_config.hasOwnProperty("source")) {
      _config.sources = [ _config.source ];
   }

   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : _owner.priority;

   if (_config.hasOwnProperty("sources")) {
      this.sources = _config.sources;
   }
   else if (_config.hasOwnProperty("source")) {
      this.sources = [ _config.source ];
   }

   if (_config.hasOwnProperty("targets")) {
      this.targets = _config.targets;
   }
   else if (_config.hasOwnProperty("target")) {
      this.targets = [ _config.target ];
   }

   if (_config.hasOwnProperty("schedules")) {
      this.schedules = _config.schedules;
   }
   else if (_config.hasOwnProperty("schedule")) {
      this.schedules = [ _config.schedule ];
   }

   if (_config.hasOwnProperty("timeout")) {
      this.timeout = _config.timeout;
      this.timeout.inheritsFrom = {};

      if (_config.timeout.hasOwnProperty('from')) {
   
         for (var z = 0; z < _config.timeout.from.length; ++z) {
            this.timeout.inheritsFrom[_config.timeout.from[z]] = true;
         }
      }
   }

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (!this.sources[i].hasOwnProperty("uName")) {
            this.sources[i].uName = this.owner.owner.uName;
         }

         var sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i]);
         this.sources[i].sourceListener = sourceListener;
         var val = (this.sources[i].hasOwnProperty('value')) ? this.sources[i].value : "DEFAULT_VALUE";

         if (!this.sourceMap[sourceListener.sourceEventName]) {
            this.sourceMap[sourceListener.sourceEventName] = {};
         }

         this.sourceMap[sourceListener.sourceEventName][val] = this.sources[i];
      }
   }

   if (this.schedules) {

      if (!this.scheduleService) {
         this.scheduleService =  this.owner.gang.findService("scheduleservice");
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
   var immediateState = this.checkSourceProperties();

   if (!immediateState) {
      this.alignTargets();
   }

   return immediateState;
};

State.prototype.alignTargets = function() {
   this.owner.alignTargetProperties(this.targets, this.priority);
};

State.prototype.checkSourceProperties = function() {
   var immediateNextState = null;

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (this.sources[i].hasOwnProperty("value") && this.sources[i].hasOwnProperty("property")) {
            var sourceName = this.sources[i].hasOwnProperty("uName") ? this.sources[i].uName : this.owner.owner.uName;
            var sourceEventName = sourceName + ":" + this.sources[i].property;
            var sourceListener = this.owner.sourceListeners[sourceEventName];
            var source = (sourceListener) ? sourceListener.getSource() : null;

            if (source && source.props.hasOwnProperty(this.sources[i].property) && (source.getProperty(this.sources[i].property) === this.sources[i].value)) {

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
};

State.prototype.scheduledEventTriggered = function(_event) {
   this.owner.owner.raiseEvent(_event.name, { sourceName: this.uName, value: _event.value });
   this.owner.set(this.name, { sourceName: this.owner.owner });
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
