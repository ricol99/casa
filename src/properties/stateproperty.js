var util = require('../util');
var NamedObject = require('../namedobject');
var Property = require('../property');
var SourceListener = require('../sourcelistener');
var Gang = require('../gang');
var State = require('../state');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.states = {};
   this.regExStates = [];
   this.controllingOwner = false;
   this.priorityDefined = _config.hasOwnProperty('priority');
   this.priority = _config.hasOwnProperty("priority") ? _config.priority : 0;
   this.currentPriority = this.priority;
   this.ignoreControl = _config.hasOwnProperty("ignoreControl") ? _config.ignoreControl : false;
   this.takeControlOnTransition = _config.hasOwnProperty("takeControlOnTransition") ? _config.takeControlOnTransition : false;
   this.allSourcesRequiredForValidity = _config.hasOwnProperty("allSourcesRequiredForValidity") ? _config.allSourcesRequiredForValidity : false;
   this.removeDuplicates = _config.hasOwnProperty("removeDuplicates") ? _config.removeDuplicates : true;
   this.bufferingActions = false;

   var regExIndex = 0;

   if (_config.hasOwnProperty("states") && (_config.states.length > 0)) {
      let defFound = false;

      for (var i = 0; i < _config.states.length; ++i) {

         if (_config.states[i].hasOwnProperty("regEx")) {
            this.regExStates.push(new State(_config.states[i], this));
         }
         else {
            this.states[_config.states[i].name] = new State(_config.states[i], this);
            defFound = defFound || (_config.states[i].name === "DEFAULT");
         }
      }

      if (!defFound) {
         this.states["DEFAULT"] = new State( { name: "DEFAULT" }, this);
      }
   }
   else {
      this.states["DEFAULT"] = new State( { name: "DEFAULT" }, this);
   }
}

util.inherits(StateProperty, Property);

// Called when system state is required
StateProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
   _exportObj.controllingOwner = this.controllingOwner;
   _exportObj.currentPriority = this.currentPriority;
   _exportObj.currentState = this.currentState ? this.currentState.name : null;
   _exportObj.previousState = this.previousState ? this.previousState.name : null;
   _exportObj.stateTimer = this.stateTimer ? this.stateTimer.left() : -1;
};

// Called before hotStart to restore system state
StateProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
   this.controllingOwner = _importObj.controllingOwner;
   this.currentPriority = _importObj.currentPriority;
   this.currentState = _importObj.currentState ? this.states[_importObj.currentState] : null;
   this.previousState = _importObj.previousState ? this.states[_importObj.previousState] : null;
   this.stateTimer = (_importObj.stateTimer === -1) ? null : _importObj.stateTimer;
};

StateProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);

   if (this.currentState && (this.currentState.hasOwnProperty("timeout"))) {
     this.stateTimer = util.setTimeout(StateProperty.prototype.timeoutInternal.bind(this), this.stateTimer,
                                        { nextState: this.currentState.timeout.nextState, action: this.currentState.timeout.actions });
   }
};

StateProperty.prototype.coldStart = function() {

   if (this.initialValueSet) {
      this.setState(null, this.value, false);
   }

   Property.prototype.coldStart.call(this);
};
   
StateProperty.prototype.propertyAboutToChange = function(_propertyValue, _data) {
   console.log(this.uName + ": state about to change to " + _propertyValue);
   var ret = this.setState(this.value, _propertyValue, _data.hasOwnProperty("priority"), _data.priority);

   if (this.currentState && this.currentState.priorityDefined) {
      _data.priority = this.currentState.priority;
   }

   return ret;
};

StateProperty.prototype.transformStateName = function(_nextStateName) {
   return (_nextStateName === "PREVIOUS-STATE") ? (this.previousState ? this.previousState.name : "") : _nextStateName;
};

StateProperty.prototype.moveToNextState = function(_nextStateName) {

   var nextStateName = this.transformStateName(_nextStateName);

   if (nextStateName === this.currentState.name) {
      nextStateName = this.resetStateTimer(this.currentState);
      
      if (nextStateName) {
         this.set(this.transformStateName(nextStateName), { sourceName: this.owner.uName });
      }
   }
   else {
      this.set(nextStateName, { sourceName: this.owner.uName });
   }
};

StateProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName + ": Event received when in state " + this.value);

   var name = _data.name
   var value = _data.value;
   var source = null;

   if (!this.sourceListeners[_sourceListener.sourceEventName]) {
      console.log(this.uName + ": Event received from sourcelistener that is not recognised! " + _sourceListener.sourceEventName);
      return;
   }

   if (this.sourceListeners[_sourceListener.sourceEventName].stateOwned) {

      if (this.currentState) {
         source = this.currentState.processSourceEvent(_sourceListener.sourceEventName, name, value);

         if (source) {

            if (source.hasOwnProperty('nextState')) {
               this.moveToNextState(source.nextState);
            }
            else if (source.hasOwnProperty('handler')) {
               this.owner[source.handler](this.currentState, _data);
            }
         }
      }
   }
   else {
      Property.prototype.newEventReceivedFromSource.call(this, _sourceListener, _data);
   }
};

StateProperty.prototype.resetStateTimer = function(_state) {
   var res = this.clearStateTimer();
   return this.setStateTimer(_state, _state, res);
};

StateProperty.prototype.clearStateTimer = function() {
   var result = { timerActive: false };
   
   if (this.stateTimer) {
      result.timeLeft = this.stateTimer.left();
      util.clearTimeout(this.stateTimer);
      result.timerActive = true;
      this.stateTimer = null;
   }

   return result;
};

StateProperty.prototype.setStateTimer = function(_previousState, _state, _timeoutDuration) {
   var timeoutDuration;
   var timeoutNextState = null;
   this.stateEntered = Date.now();

   if (_state.hasOwnProperty('timeout')) {

      if (_previousState && _state.timeout.inheritsFrom[_previousState.name]) {

         if (_timeoutDuration == undefined) {

            if (_state.timeout.hasOwnProperty('duration')) {
               timeoutDuration = _state.timeout.duration * 1000;
            }
            else {
               return null;
            }
         }
         else if (_state.timeout.hasOwnProperty('duration')) {
            timeoutDuration = (_timeoutDuration < _state.timeout.duration * 1000) ? _timeoutDuration : _state.timeout.duration * 1000;
         }
         else if (_state.timeout.hasOwnProperty('property')) {
            var value = this.owner.getProperty(_state.timeout.property);

            if (typeof value !== 'number') {

                if (typeof value === 'string') {
                  value = parseInt(value);
                }
                else {
                   console.error(this.uName + ": Unable to set timer from property " + _state.timeout.property + " as the property is not a number");
                   return null;
                }
            }

            timeoutDuration = (_timeoutDuration < value * 1000) ? _timeoutDuration : value * 1000;
         }
         else {
            timeoutDuration = _timeoutDuration;
         }

         if (_state.timeout.hasOwnProperty('nextState')) {
            timeoutNextState = _state.timeout.nextState;
         }
      }
      else if (_state.timeout.hasOwnProperty('duration')) {
         timeoutDuration = _state.timeout.duration * 1000;
         timeoutNextState = _state.timeout.nextState;
      }
      else if (_state.timeout.hasOwnProperty('property') || _state.timeout.hasOwnProperty('source')) {
         var value = _state.timeout.hasOwnProperty('property') ? this.owner.getProperty(_state.timeout.property) : _state.timeout.source.sourceListener.getPropertyValue();
            
         if (typeof value !== 'number') {
                
             if (typeof value === 'string') {
               value = parseInt(value);
             }
             else {
                console.error(this.uName + ": Unable to set timer from property " + _state.timeout.property + " as the property is not a number");
                return null;
             }
         }

         timeoutDuration = value * 1000;
         timeoutNextState = _state.timeout.nextState;
      }
      else {
         return null;
      }

      if (timeoutDuration === 0) {
         return timeoutNextState;
      }
      else if (timeoutDuration > 0) {
         this.stateTimer = util.setTimeout(StateProperty.prototype.timeoutInternal.bind(this), timeoutDuration,
                                           { nextState: _state.timeout.nextState, actions: _state.timeout.actions });
      }
   }

   return null;
};

StateProperty.prototype.timeoutInternal = function(_timeout) {
   this.stateTimer = null;
   this.owner.newTimeoutTransaction();

   if (_timeout.hasOwnProperty("actions") && _timeout.actions) {
      this.alignActions(_timeout.actions, this.currentState.priority);
   }

   if (_timeout.hasOwnProperty("nextState")) {
      this.moveToNextState(_timeout.nextState);
   }
};

StateProperty.prototype.matchRegExState = function(_stateName) {
   var state = this.states["DEFAULT"];

   for (let i = 0; i < this.regExStates.length; ++i) {

      if (this.regExStates[i].regEx.test(_stateName)) {
         state = this.regExStates[i];
         break;
      }
   }

   return state;
};

StateProperty.prototype.matchState = function(_stateName) {

   if (this.states.hasOwnProperty(_stateName)) {
      return this.states[_stateName];
   }
   else {
      return this.matchRegExState(_stateName);
   }

   return state;
};

StateProperty.prototype.setState = function(_previousStateName, _nextStateName, _parentPropertyPriorityDefined, _parentPropertyPriority, _immediateTransfer, _previousTimeLeft, _depth) {
   console.log(this.uName+": setState state="+_nextStateName);
   var depth = _depth ? _depth + 1 : 1;

   if (depth > 10) {
      console.error(this.uName + ": State machine is broken as state model has gone through 10 immediate state transitions");
      process.exit(3);
   }

   this.startBufferingActionsInternal();

   this.previousState = this.matchState(_previousStateName);
   var currentMatchedState = (this.cold) ? null : this.matchState(_previousStateName);
   var nextMatchedState = this.matchState(_nextStateName);
   var clearTimerResult = {};

   if (currentMatchedState !== nextMatchedState) {

      if (currentMatchedState) {

         if (_immediateTransfer) {

            if (currentMatchedState && currentMatchedState.hasOwnProperty("timeout")) {

               if (currentMatchedState.timeout.hasOwnProperty("duration")) {
                  clearTimerResult = { timeLeft: currentMatchedState.timeout.duration * 1000 };
               }
               else if (currentMatchedState.timeout.hasOwnProperty("property") || currentMatchedState.timeout.hasOwnProperty("source")) {
                  var value = currentMatchedState.timeout.hasOwnProperty('property') ? this.owner.getProperty(currentMatchedState.timeout.property)
                                                                                     : currentMatchedState.timeout.source.sourceListener.getPropertyValue();
                  if (typeof value !== 'number') {
   
                     if (typeof value === 'string') {
                        clearTimerResult = { timeLeft: parseInt(value) * 1000 };
                     }
                     else {
                        console.error(this.uName + ": Unable to set timer from property/source as the property/source is not a number");
                        clearTimerResult = { timeLeft: 0 };
                     }
                  }
                  else {
                     clearTimerResult = { timeLeft: value * 1000 };
                  }
               }
               else {
                  clearTimerResult = { timeLeft: _previousTimeLeft };
               }
            }
         }
         else {
            clearTimerResult = this.clearStateTimer();

            if (clearTimerResult.timerActive && (clearTimerResult.timeLeft <= 0) && _previousStateName && this.states.hasOwnProperty(_previousStateName) &&
                this.states[_previousStateName].hasOwnProperty('timeout')) {
               // Edge case where the timeout has already expired and waiting for the event loop to schedule. We have just cancelled it
               console.log(this.uName + ": Edge case - previous state timer has already expired and is waiting to be scheduled, manually modify the time left so that it expires in the next state");
               clearTimerResult.timeLeft = 1;
            }

            currentMatchedState.exiting();
         }
      }

      if (nextMatchedState) {
         var immediateNextState = nextMatchedState.initialise(_parentPropertyPriorityDefined, _parentPropertyPriority, this.states[_previousStateName]);

         if (immediateNextState) {
            console.log(this.uName + ": Initialise() ImmediateState state transfer to " + immediateNextState);
            return this.setState(nextMatchedState.name, this.transformStateName(immediateNextState), _parentPropertyPriorityDefined, _parentPropertyPriority, true, clearTimerResult.timeLeft, depth);
         }

         this.currentState = nextMatchedState;
         immediateNextState = this.setStateTimer(currentMatchedState, nextMatchedState, clearTimerResult.timeLeft);

         if (immediateNextState) {
            console.log(this.uName + ": Initialise() ImmediateState state transfer to " + immediateNextState + " due to zero timer");
            return this.setState(nextMatchedState.name, this.transformStateName(immediateNextState), _parentPropertyPriorityDefined, _parentPropertyPriority, true, clearTimerResult.timeLeft, depth);
         }
      }
      else {
         console.error(this.uName + ": Unable to change state to " + _nextStateName + " as it is not defined! Staying in existing state.");
      }
   }
   else {
      console.log(this.uName + ": Not changing state as nextMatchedState= " + nextMatchedState.name + " is the same as the current matched state");
   }

   this.flushBufferedActionsInternal();
   return _nextStateName;
};

StateProperty.prototype.takeControl = function(_priority) {
   this.currentPriority = _priority;
   return this.owner.takeControl(this, this.currentPriority, this.ignoreControl);
};

StateProperty.prototype.raiseEvent = function(_eventName, _data) {
   this.owner.raiseEvent(_eventName, _data);
};

StateProperty.prototype.resolvePropertyValues = function(_properties) {
};

StateProperty.prototype.alignProperties = function(_properties) {

   if ((_properties && _properties.length > 0) && (this.takeControl((this.currentState) ? this.currentState.priority : this.priority))) {
      this.owner.alignProperties(_properties);
   }
};

StateProperty.prototype.alignActions = function(_actions, _priority) {

   if (_actions) {
      this.processActionsInternal(_actions);

      if (this.bufferingActions) {
         console.log(this.uName+": StateProperty.prototype.alignActions() Buffering actions...");

         for (var a = 0; a < _actions.length; ++a) {
            var actionDupType = (_actions[a].hasOwnProperty("property")) ? "propDup" : "eventDup";
            var actionType = (_actions[a].hasOwnProperty("property")) ? "properties" : "events";
            var name = (actionType === "properties") ? _actions[a].property : _actions[a].event;
   
            if (this.takeControl(_priority)) {
              
               if (this.actionBuffer[actionDupType].hasOwnProperty(name)) {
                  this.actionBuffer[actionType][this.actionBuffer[actionDupType][name]] = _actions[a];
               }
               else {
                  this.actionBuffer[actionDupType][name] = this.actionBuffer[actionType].length;
                  this.actionBuffer[actionType].push(_actions[a]);
               }
            }
         }
      }
      else {
         this.alignActionsInternal(_actions, _priority);
      }
   }
};

StateProperty.prototype.processActionsInternal = function(_actions) {
   
   for (var z = 0; z < _actions.length; ++z) {

      if (_actions[z].hasOwnProperty("property")) {
   
         if (_actions[z].hasOwnProperty("fromProperty")) {
            _actions[z].value = this.owner.getProperty(_actions[z].fromProperty);
         }
         else if (_actions[z].hasOwnProperty("source")) {
            _actions[z].value = _actions[z].source.sourceListener.getPropertyValue();
         }
         else if (_actions[z].hasOwnProperty("apply")) {
            var currentValue = this.owner.getProperty(_actions[z].property);
            var output = false;
            var exp = _actions[z].apply.replace(/\$value/g, "currentValue");
            var exp2 = exp.replace(/\$stateDuration/g, "(Math.round((Date.now()-this.stateEntered)/100.0)/10.0)");
            eval("output = " + exp2);
            _actions[z].value = output;
         }
      }
   }
};

StateProperty.prototype.alignPropertiesInternal = function(_properties) {

   if (_properties.length > 0) {
      this.owner.alignProperties(_properties);
   }
};

StateProperty.prototype.alignEventsInternal = function(_events) {

   for (var e = 0; e < _events.length; ++e) {
      this.raiseEvent(_events[e].event, (_events[e].hasOwnProperty("value")) ? { value: _events[e].value } : undefined );
   }
};

StateProperty.prototype.alignActionsInternal = function(_actions, _priority) {

   if (_actions && this.takeControl(_priority)) {
      var properties = [];
      var events = [];

      for (var a = 0; a < _actions.length; ++a) {
         var arr = (_actions[a].hasOwnProperty("property")) ? properties : events;
         arr.push(_actions[a]);
      }

      this.alignPropertiesInternal(properties, _priority);
      this.alignEventsInternal(events, _priority);
   }
};

StateProperty.prototype.startBufferingActionsInternal = function() {

   if (this.removeDuplicates && !this.bufferingActions) {
      this.bufferingActions = true;
      this.actionBuffer = { propDup: {}, eventDup: {}, properties: [], events: [] };
   }
};

StateProperty.prototype.flushBufferedActionsInternal = function() {

   if (this.removeDuplicates && this.bufferingActions) {
      console.log(this.uName+": StateProperty.prototype.flushBufferedActionsInternal() Flushing buffered actions...");
      this.alignPropertiesInternal(this.actionBuffer.properties);
      this.alignEventsInternal(this.actionBuffer.events);
      this.bufferingActions = false;
      delete this.actionBuffer;
   }
};

StateProperty.prototype.becomeController = function() {
   console.log(this.uName+": StateProperty.prototype.becomeController()");
   // I am now the controller
   this.controllingOwner = true;

   // Re-apply current state. but try to avoid race conditions
   if (this.currentState) {

      setTimeout((_state) => {

         if (this.currentState === _state) {
            this.currentState.alignActions();
         }
      }, 100, this.currentState);
   }
};

StateProperty.prototype.ceasedToBeController = function(_newController) {
   this.controllingOwner = false;
};

StateProperty.prototype.fetchOrCreateSourceListener = function(_config) {
   var sourceListenerName;

   if (!_config.hasOwnProperty("uName") || _config.uName == undefined) {
      _config.uName = this.owner.uName;
   }

   if (_config.hasOwnProperty("value")) {
      sourceListenerName = _config.uName + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event) + ":" + _config.value.toString();
   }
   else {
      sourceListenerName = _config.uName + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event);
   }

   var sourceListener = this.sourceListeners[sourceListenerName];

   if (!sourceListener) {
      sourceListener = new SourceListener(_config, this);
      this.sourceListeners[sourceListenerName] = sourceListener;
      sourceListener.stateOwned = true;
      sourceListener.counter = 0;
   }
   else {
      sourceListener.stateOwned = true;
      sourceListener.counter = 0;
   }

   return sourceListener;
};

StateProperty.prototype.launchActionFunction = function(_actionHandler, _priority) {

   if (this.takeControl(_priority)) {
       return this.owner[_actionHandler](this.currentState);
   }

   return false;
};

StateProperty.prototype.ownerHasNewName = function() {
   NamedObject.prototype.ownerHasNewName.call(this);

   for (var state in this.states) {

      if (this.states.hasOwnProperty(state)) {
         this.states[state].ownerHasNewName();
      }
   }
};

StateProperty.prototype.iAmCurrent = function(_state) {
   return this.currentState === _state;
};

module.exports = exports = StateProperty;
