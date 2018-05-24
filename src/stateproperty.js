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
   this.ignoreControl = (_config.hasOwnProperty("ignoreControl")) ? _config.ignoreControl : false;
   this.takeControlOnTransition = (_config.hasOwnProperty("takeControlOnTransition")) ? _config.takeControlOnTransition : false;

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

   var name = _data.name
   var value = _data.value;
   var currentState = this.states[this.value];
   var source = null;

   if (!this.sourceListeners[_sourceListener.sourceEventName]) {
      console.log(this.uName + ": Event received from sourcelistener that is not recognised! " + _sourceListener.sourceEventName);
      return;
   }

   if (currentState) {
      source = currentState.processSourceEvent(_sourceListener.sourceEventName, name, value);
   }
   else if (this.states["DEFAULT"]) {
      source = this.states["DEFAULT"].processSourceEvent(_sourceListener.sourceEventName, name, value);
   }

   if (source) {

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

      if (_state.timeout.inheritsFrom[this.states[this.value].name]) {

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

   if (_nextState === "PREVIOUS-STATE") {
      nextState = this.previousState;
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
               console.log(this.uName+": Immediate State transition, nextState="+nextState);
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
      console.log(this.uName + ": Edge case - previous state timer has already expired and is waiting to be scheduled, manually modify the time left so that it expires in the next state");
      clearTimerResult.timeLeft = 1;
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

StateProperty.prototype.takeControl = function(_priority) {
   this.currentPriority = _priority;
   return this.owner.takeControl(this, this.currentPriority);
};

StateProperty.prototype.alignTargetPropertiesAndEvents = function(_targets, _events, _priority) {

   if (((_targets && _targets.length > 0) || (_events && _events.length > 0)) && (this.ignoreControl || this.takeControl(_priority))) {

      if (_targets) {
         this.owner.alignProperties(_targets);
      }

      if (_events) {

         for (var i = 0; i < _events.length; ++i) {
            this.owner.raiseEvent(_events[i].name);
         }
      }
   }
};

StateProperty.prototype.becomeController = function() {
   // I am now the controller
   this.controllingOwner = true;

   // Re-apply current state
   if (this.states[this.value]) {
      this.states[this.value].alignTargetsAndEvents();
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
   this.activeGuardedSources = [];
   this.activeGuardedTargets = [];

   if (_config.hasOwnProperty("source")) {
      _config.sources = [ _config.source ];
   }

   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : _owner.priority;

   if (_config.hasOwnProperty("sources")) {
      this.sources = _config.sources;

      for (var k = 0; k < this.sources.length; ++k) {

         if (this.sources[k].hasOwnProperty('guard')) {
            this.sources[k].guards = [ this.sources[k].guard ];
         }
      }
   }

   if (_config.hasOwnProperty("target")) {
      _config.targets = [ _config.target ];
   }

   if (_config.hasOwnProperty("targets")) {
      this.targets = _config.targets;

      for (var l = 0; l < this.targets.length; ++l) {

         if (this.targets[l].hasOwnProperty('guard')) {
            this.targets[l].guards = [ this.targets[l].guard ];
         }
      }
   }

   if (_config.hasOwnProperty("events")) {
      this.events = _config.events;
   }
   else if (_config.hasOwnProperty("event")) {
      this.events = [ _config.event ];
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

         if (!this.sourceMap[sourceListener.sourceEventName][val]) {
            this.sourceMap[sourceListener.sourceEventName][val] = [];
         }

         this.sourceMap[sourceListener.sourceEventName][val].push(this.sources[i]);

         if (this.sources[i].hasOwnProperty("guards")) {

            for (var k = 0; k < this.sources[i].guards.length; ++k) {
               this.sources[i].guards[k].uName = this.owner.owner.uName;
               this.sources[i].guards[k].sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i].guards[k]);
            }
         }
      }
   }

   if (this.targets) {

      for (var l = 0; l < this.targets.length; l++) {

         if (this.targets[l].hasOwnProperty("guards")) {

            for (var m = 0; m < this.targets[l].guards.length; ++m) {
               this.targets[l].guards[m].uName = this.owner.owner.uName;
               this.targets[l].guards[m].sourceListener = this.owner.fetchOrCreateSourceListener(this.targets[l].guards[m]);
            }
         }
      }
   }

   if (this.schedules) {

      if (!this.scheduleService) {
         this.scheduleService =  this.owner.gang.findService("scheduleservice");
      }

      if (!this.scheduleService) {
         console.error(this.uName + ": ***** Schedule service not found! *************");
         process.exit(3);
      }

      // TBD XXX Currently ignoring return value. Should I use it to determine which state we are in mulitple schedules?
      // Could use state timeout + schedule to do this, may not work though
      this.scheduleService.registerEvents(this, this.schedules);
   }
}

State.prototype.initialise = function() {
   var immediateState = this.checkSourceProperties();

   if (!immediateState) {

      if (!this.alignTargetsAndEvents() && this.owner.takeControlOnTransition) {
         this.owner.takeControl(this.priority);
      }
   }

   return immediateState;
};

State.prototype.processSourceEvent = function(_sourceEventName, _name, _value) {
   var sources = null;
   var source = this.checkActiveSourceGuards(_name, _value);

   if (source) {
      console.log(this.uName+": processSourceEvent() active guard is now met");
      return source;
   }

   if (this.sourceMap[_sourceEventName]) {
      sources = (this.sourceMap[_sourceEventName][_value]) ? this.sourceMap[_sourceEventName][_value] : this.sourceMap[_sourceEventName]["DEFAULT_VALUE"];
   }
   
   if (sources) {
      
      for (var i = 0; i < sources.length; ++i) {
         
         if (sources[i].hasOwnProperty("nextState")) { 
            
            if (this.checkGuard(sources[i], this.activeGuardedSources)) {
               return sources[i];
            }
         }
      }
   }
   else if (this.processActiveTargetGuards(_name, _value)) {
      return null;
   }

   return null;
};

State.prototype.checkGuard = function(_guardedObject, _activeQueue) {

   if (!_guardedObject) {
      return false;
   }

   if (_guardedObject.hasOwnProperty("guards")) {

      for (var i = 0; i < _guardedObject.guards.length; ++i) {
         var guardPropertyValue = _guardedObject.guards[i].hasOwnProperty("value") ? _guardedObject.guards[i].value : true;

         if (this.owner.owner.getProperty(_guardedObject.guards[i].property) !== guardPropertyValue) {

            if (_activeQueue && ((_guardedObject.guards[i].hasOwnProperty("active") && _guardedObject.guards[i].active)
                                 || !_guardedObject.guards[i].hasOwnProperty("active"))) {

               _activeQueue.push(_guardedObject);
            }
            return false;
         }
      }
   }

   return true;
};

State.prototype.processActiveTargetGuards = function(_propName, _propValue) {
   var targetPropertiesMet = [];
   var targetEventsMet = [];

   for (var a = 0; a < this.activeGuardedTargets.length; ++a) {

      for (var i = 0; i < this.activeGuardedTargets[a].guards.length; ++i) {
         var guardActive = (this.activeGuardedTargets[a].guards[i].hasOwnProperty("active")) ? this.activeGuardedTargets[a].guards[i].active : true;

         if (guardActive && (this.activeGuardedTargets[a].guards[i].property === _propName)) {
            var guardPropertyValue = this.activeGuardedTargets[a].guards[i].hasOwnProperty("value") ? this.activeGuardedTargets[a].guards[i].value : true;

            if ((_propValue === guardPropertyValue) && this.checkGuard(this.activeGuardedTargets[a])) {
               console.log(this.uName + ": checkActiveTargetGuards() Found active guard!");
               this.activeGuardedTargets[a]._index = a;

               if (this.activeGuardedTargets[a].hasOwnProperty("property")) {
                  targetPropertiesMet.push(this.activeGuardedTargets[a]);
               }
               else {
                  targetEventsMet.push(this.activeGuardedTargets[a]);
               }
            }
         }
      }
   }

   // Remove met targets from active queue
   for (var b = 0; b < targetPropertiesMet.length; ++b) {
      this.activeGuardedTargets.splice(targetPropertiesMet[b]._index-b, 1);
   }

   for (var c = 0; c < targetEventsMet.length; ++c) {
      this.activeGuardedTargets.splice(targetEventsMet[c]._index-c-b, 1);
   }

   // Process met targets
   if ((targetPropertiesMet.length > 0) || (targetEventsMet.length > 0)) {
      this.owner.alignTargetPropertiesAndEvents(targetPropertiesMet, targetEventsMet, this.priority);
      return true;
   }
   else {
      return false;
   }
};

State.prototype.checkActiveSourceGuards = function(_propName, _propValue) {

   for (var a = 0; a < this.activeGuardedSources.length; ++a) {

      for (var i = 0; i < this.activeGuardedSources[a].guards.length; ++i) {
         var guardActive = (this.activeGuardedSources[a].guards[i].hasOwnProperty("active")) ? this.activeGuardedSources[a].guards[i].active : true;

         if (guardActive && (this.activeGuardedSources[a].guards[i].property === _propName)) {
            var guardPropertyValue = this.activeGuardedSources[a].guards[i].hasOwnProperty("value") ? this.activeGuardedSources[a].guards[i].value : true;

            if ((_propValue === guardPropertyValue) && this.checkGuard(this.activeGuardedSources[a])) {
               console.log(this.uName + ": checkActiveSourceGuards() Found active guard!");
               return this.activeGuardedSources[a];
            }
         }
      }
   }

   return null;
};

State.prototype.filterTargetsAndEvents = function(_targetsOrEvents) {

   if (!_targetsOrEvents) {
      return null;
   }

   var newTargetsOrEvents = [];

   for (var i = 0; i < _targetsOrEvents.length; ++i) {

      if (this.checkGuard(_targetsOrEvents[i], this.activeGuardedTargets)) {
         newTargetsOrEvents.push(_targetsOrEvents[i]);
      }
   }

   return newTargetsOrEvents;
}

State.prototype.alignTargetsAndEvents = function() {
   var newTargets = this.filterTargetsAndEvents(this.targets);
   var newEvents = this.filterTargetsAndEvents(this.events);
   this.owner.alignTargetPropertiesAndEvents(newTargets, newEvents, this.priority);
   return ((newTargets && (newTargets.length > 0)) || (newEvents && (newEvents.length > 0)));
};

State.prototype.checkSourceProperties = function() {
   var immediateNextState = null;

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (this.checkGuard(this.sources[i]) && this.sources[i].hasOwnProperty("value") && this.sources[i].hasOwnProperty("property")) {
            var sourceName = this.sources[i].hasOwnProperty("uName") ? this.sources[i].uName : this.owner.owner.uName;
            var sourceEventName = sourceName + ":" + this.sources[i].property;
            var sourceListener = this.owner.sourceListeners[sourceEventName];
            var source = (sourceListener) ? sourceListener.getSource() : null;

            if (source && source.props.hasOwnProperty(this.sources[i].property) && (source.getProperty(this.sources[i].property) === this.sources[i].value)) {

               // Property already matches so move to next state immediately
               if (this.sources[i].hasOwnProperty("nextState") && (this.sources[i].nextState !== this.name)) {
                  immediateNextState = this.sources[i].nextState;
                  console.log(this.uName+": Immediate state transition match! source="+this.sources[i].uName+" property="+this.sources[i].property+" value="+this.sources[i].value);
                  break;
               }
            }
         }
      }
   }

   return immediateNextState;
};

State.prototype.exiting = function(_event, _value) {
   this.activeGuardedSources = [];
   this.activeGuardedTargets = [];
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
