var util = require('util');
var NamedObject = require('./namedobject');
var Property = require('./property');
var SourceListener = require('./sourcelistener');
var Gang = require('./gang');
var State = require('./state');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.states = {};
   this.regExStates = [];
   this.controllingOwner = false;
   this.priorityDefined = _config.hasOwnProperty('priority');
   this.priority = (_config.hasOwnProperty("priority")) ? _config.priority : 0;
   this.currentPriority = this.priority;
   this.ignoreControl = (_config.hasOwnProperty("ignoreControl")) ? _config.ignoreControl : false;
   this.takeControlOnTransition = (_config.hasOwnProperty("takeControlOnTransition")) ? _config.takeControlOnTransition : false;
   this.allSourcesRequiredForValidity = (_config.hasOwnProperty("allSourcesRequiredForValidity")) ? _config.allSourcesRequiredForValidity : false;

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

   if (Property.prototype.export.call(this, _exportObj)) {
      _exportObj.controllingOwner = this.controllingOwner;
      _exportObj.currentPriority = this.currentPriority;
      _exportObj.currentState = this.currentState ? this.currentState.name : null;
      _exportObj.previousState = this.previousState ? this.previousState.name : null;
      _exportObj.stateTimer = this.stateTimer ? this.stateTimer.expiration() : -1;

      return true;
   }

   return false;
};

StateProperty.prototype.coldStart = function(_data) {

   if (this.initialValueSet) {
      this.setState(this.value, false);
   }

   Property.prototype.coldStart.call(this, _data);
};
   
StateProperty.prototype.propertyAboutToChange = function(_propertyValue, _data) {
   console.log(this.uName + ": state about to change to " + _propertyValue);
   this.setState(_propertyValue, _data.hasOwnProperty("priority"), _data.priority);

   if (this.currentState && this.currentState.priorityDefined) {
      _data.priority = this.currentState.priority;
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

               var nextState = this.transformNextState(source.nextState);

               if ((source.nextState === this.currentState.name) || (nextState === this.currentState.name)) {
                  this.resetStateTimer(this.currentState);
               }
               else {
                  this.set(nextState, { sourceName: this.owner.uName });
               }
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
   this.setStateTimer(_state, res);
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

StateProperty.prototype.setStateTimer = function(_state, _timeoutDuration) {

   if (_state.hasOwnProperty('timeout')) {

      if (this.states.hasOwnProperty(this.value) && _state.timeout.inheritsFrom[this.states[this.value].name]) {

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
         else if (_state.timeout.hasOwnProperty('property')) {
            var value = this.owner.getProperty(_state.timeout.property);

            if (typeof value !== 'number') {

                if (typeof value === 'string') {
                  value = parseInt(value);
                }
                else {
                   console.error(this.uName + ": Unable to set timer from property " + _state.timeout.property + " as the property is not a number");
                   return;
                }
            }

            this.timeoutDuration = (_timeoutDuration < value * 1000) ? _timeoutDuration : value * 1000;
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
      else if (_state.timeout.hasOwnProperty('property') || _state.timeout.hasOwnProperty('source')) {
         var value = _state.timeout.hasOwnProperty('property') ? this.owner.getProperty(_state.timeout.property) : _state.timeout.source.sourceListener.getPropertyValue();
            
         if (typeof value !== 'number') {
                
             if (typeof value === 'string') {
               value = parseInt(value);
             }
             else {
                console.error(this.uName + ": Unable to set timer from property " + _state.timeout.property + " as the property is not a number");
                return;
             }
         }

         this.timeoutDuration = value * 1000;
         this.timeoutNextState = _state.timeout.nextState;
      }
      else {
         return;
      }

      this.stateTimer = util.setTimeout(StateProperty.prototype.timeoutInternal.bind(this), this.timeoutDuration, this.timeoutNextState);
   }
};

StateProperty.prototype.timeoutInternal = function(_timeoutState) {
   this.stateTimer = null;

   var nextState = this.transformNextState(_timeoutState);

   if (nextState === this.currentState.name) {
      // Immediate next state is the same as the one we are in. Restart timer
      this.resetStateTimer(this.currentState)
   }
   else {
      this.set(nextState, { sourceName: this.owner.uName });
   }
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

StateProperty.prototype.setState = function(_nextStateName, _parentPropertyPriorityDefined, _parentPropertyPriority) {
   console.log(this.uName+": setState state="+_nextStateName);
   this.previousState = this.value;

   var currentMatchedState = (this.cold) ? null : this.matchState(this.value);
   var nextMatchedState = this.matchState(_nextStateName);
   var clearTimerResult = {};

   if (currentMatchedState !== nextMatchedState) {

      if (currentMatchedState) {
         clearTimerResult = this.clearStateTimer();

         if (clearTimerResult.timerActive && (clearTimerResult.timeLeft <= 0) && this.states[this.value].hasOwnProperty('timeout')) {
            // Edge case where the timeout has already expired and waiting for the event loop to schedule. We have just cancelled it
            console.log(this.uName + ": Edge case - previous state timer has already expired and is waiting to be scheduled, manually modify the time left so that it expires in the next state");
            clearTimerResult.timeLeft = 1;
         }

         currentMatchedState.exiting();
      }

      if (nextMatchedState) {
         var immediateNextState = nextMatchedState.initialise(_parentPropertyPriorityDefined, _parentPropertyPriority);

         if (immediateNextState) {
            console.log(this.uName + ": Initialise() ImmediateState state transfer to " + immediateNextState);
            this.owner.alignPropertyValue(this.name, this.transformNextState(immediateNextState));
         }
         else {
            this.currentState = nextMatchedState;
         }

         this.setStateTimer(nextMatchedState, clearTimerResult.timeLeft);
      }
      else {
         console.error(this.uName + ": Unable to change state to " + _nextStateName + " as it is not defined! Staying in existing state.");
      }
   }
   else {
      console.log(this.uName + ": Not changing state as nextMatchedState= " + nextMatchedState.name + " is the same as the current matched state");
   }
};

StateProperty.prototype.takeControl = function(_priority) {
   this.currentPriority = _priority;
   return this.owner.takeControl(this, this.currentPriority);
};

StateProperty.prototype.raiseEvent = function(_eventName, _data) {
   this.owner.raiseEvent(_eventName, _data);
};

StateProperty.prototype.resolvePropertyValues = function(_properties) {
};

StateProperty.prototype.alignProperties = function(_properties) {

   if ((_properties && _properties.length > 0) && (this.ignoreControl || this.takeControl((this.currentState) ? this.currentState.priority : this.priority))) {
      this.owner.alignProperties(_properties);
   }
};

StateProperty.prototype.alignActions = function(_actions, _priority) {

   if (_actions && (this.ignoreControl || this.takeControl(_priority))) {
      var props = [];
      var events = [];

      for (var a = 0; a < _actions.length; ++a) {
         var arr = (_actions[a].hasOwnProperty("property")) ? props : events;
         arr.push(_actions[a]);
      }

      if (props.length > 0) {

         for (var z = 0; z < props.length; ++z) {

            if (props[z].hasOwnProperty("fromProperty")) {
               props[z].value = this.owner.getProperty(props[z].fromProperty);
            }
            else if (props[z].hasOwnProperty("source")) {
               props[z].value = props[z].source.sourceListener.getPropertyValue();
            }
            else if (props[z].hasOwnProperty("apply")) {
               var currentValue = this.owner.getProperty(props[z].property);
               var output = false;
               var exp = props[z].apply.replace(/\$value/g, "currentValue");
               eval("output = " + exp);
               props[z].value = output;
            }
         }

         this.owner.alignProperties(props);
      }

      for (var e = 0; e < events.length; ++e) {
         this.raiseEvent(events[e].event, (events[e].hasOwnProperty("value")) ? { value: events[e].value } : undefined );
      }
   }
};


StateProperty.prototype.becomeController = function() {
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
   }

   return sourceListener;
};

StateProperty.prototype.launchActionFunction = function(_actionHandler, _priority) {

   if (this.ignoreControl || this.takeControl(_priority)) {
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

module.exports = exports = StateProperty;
