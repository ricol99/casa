var util = require('util');
var NamedObject = require('./namedobject');
var Property = require('./property');
var SourceListener = require('./sourcelistener');
var Gang = require('./gang');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.states = {};
   this.regExStates = [];
   this.controllingOwner = false;
   this.priority = (_config.hasOwnProperty("priority")) ? _config.priority : 0;
   this.currentPriority = this.priority;
   this.ignoreControl = (_config.hasOwnProperty("ignoreControl")) ? _config.ignoreControl : false;
   this.takeControlOnTransition = (_config.hasOwnProperty("takeControlOnTransition")) ? _config.takeControlOnTransition : false;
   this.allSourcesRequiredForValidity = (_config.hasOwnProperty("allSourcesRequiredForValidity")) ? _config.allSourcesRequiredForValidity : false;

   var regExIndex = 0;

   if (_config.hasOwnProperty("states")) {

      for (var i = 0; i < _config.states.length; ++i) {

         if (_config.states[i].hasOwnProperty("regEx")) {
            this.regExStates.push(new State(_config.states[i], this));
         }
         else {
            this.states[_config.states[i].name] = new State(_config.states[i], this);
         }
      }
   }
}

util.inherits(StateProperty, Property);

StateProperty.prototype.coldStart = function(_data) {

   if (this.initialValueSet) {
      this.setState(this.value);
   }

   Property.prototype.coldStart.call(this, _data);
};
   
StateProperty.prototype.propertyAboutToChange = function(_propertyValue, _data) {
   console.log(this.fullName + ": state about to change to " + _propertyValue);
   this.setState(_propertyValue);
};

StateProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.fullName + ": Event received when in state " + this.value);

   var name = _data.name
   var value = _data.value;
   var source = null;

   if (!this.sourceListeners[_sourceListener.sourceEventName]) {
      console.log(this.fullName + ": Event received from sourcelistener that is not recognised! " + _sourceListener.sourceEventName);
      return;
   }

   if (this.sourceListeners[_sourceListener.sourceEventName].stateOwned) {

      if (this.currentState) {
         source = this.currentState.processSourceEvent(_sourceListener.sourceEventName, name, value);

         if (source) {

            if (source.hasOwnProperty('nextState')) {

               if (source.nextState === this.currentState.name) {
                  this.resetStateTimer(this.currentState);
               }
               else {
                  this.set(this.transformNextState(source.nextState), { sourceName: this.owner.fullName });
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
         else if (_state.timeout.hasOwnProperty('property')) {
            var value = this.owner.getProperty(_state.timeout.property);

            if (typeof value !== 'number') {

                if (typeof value === 'string') {
                  value = parseInt(value);
                }
                else {
                   console.error(this.fullName + ": Unable to set timer from property " + _state.timeout.property + " as the property is not a number");
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
      else if (_state.timeout.hasOwnProperty('property')) {
         var value = this.owner.getProperty(_state.timeout.property);
            
         if (typeof value !== 'number') {
                
             if (typeof value === 'string') {
               value = parseInt(value);
             }
             else {
                console.error(this.fullName + ": Unable to set timer from property " + _state.timeout.property + " as the property is not a number");
                return;
             }
         }

         this.timeoutDuration = value * 1000;
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
   this.set(this.transformNextState(_timeoutState), { sourceName: this.owner.fullName });
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
               console.log(this.fullName+": Immediate State transition, nextState="+nextState);
            }
         }
         else {
            break;
         }
      }

      if (immediateNextState) {
         console.error(this.fullName + ": State machine is broken as state model has gone through 10 immediate state transitions");
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

StateProperty.prototype.setState = function(_nextStateName) {
   console.log(this.fullName+": setState state="+_nextStateName);
   this.previousState = this.value;

   var clearTimerResult = this.clearStateTimer();

   if (clearTimerResult.timerActive && (clearTimerResult.timeLeft <= 0) && this.states[this.value].hasOwnProperty('timeout')) {
      // Edge case where the timeout has already expired and waiting for the event loop to schedule. We have just cancelled it
      console.log(this.fullName + ": Edge case - previous state timer has already expired and is waiting to be scheduled, manually modify the time left so that it expires in the next state");
      clearTimerResult.timeLeft = 1;
   }

   var nextState = (this.states[_nextStateName]) ? this.states[_nextStateName] : this.matchRegExState(_nextStateName);

   if (!this.cold) {

      if (this.states[this.value]) {
         this.states[this.value].exiting();
      }
      else {
         var currentRegExState = this.matchRegExState(this.value);

         if (currentRegExState && nextState && (currentRegExState != nextState)) {
            currentRegExState.exiting();
         }

         //if (this.states["DEFAULT"] && this.states[_nextStateName]) {
            //this.states["DEFAULT"].exiting();
         //}
      }
   }

   //var nextState = (this.states[_nextStateName]) ? this.states[_nextStateName] : this.states["DEFAULT"];

   if (nextState) {
      var immediateNextState = nextState.initialise();

      if (immediateNextState) {
         console.log(this.fullName + ": Initialise() ImmediateState state transfer to " + immediateNextState);

         setTimeout( (_nextStateName) => {
            this.set(_nextStateName, { sourceName: this.owner.fullName });
         }, 1, this.transformNextState(immediateNextState));
      }
      else {
         this.currentState = nextState;
      }

      this.setStateTimer(nextState, clearTimerResult.timeLeft);
   }
   else {
      console.error(this.fullName + ": Unable to change state to " + _nextStateName + " as it is not defined! Staying in existing state.");
   }
};

StateProperty.prototype.takeControl = function(_priority) {
   this.currentPriority = _priority;
   return this.owner.takeControl(this, this.currentPriority);
};

StateProperty.prototype.raiseEvent = function(_eventName, _data) {
   this.owner.raiseEvent(_eventName, _data);
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
      }, 500, this.currentState);
   }
};

StateProperty.prototype.ceasedToBeController = function(_newController) {
   this.controllingOwner = false;
};

StateProperty.prototype.fetchOrCreateSourceListener = function(_config) {
   var sourceListenerName;

   if (!_config.hasOwnProperty("fullName") || _config.fullName == undefined) {
      _config.fullName = this.owner.fullName;
   }

   if (_config.hasOwnProperty("value")) {
      sourceListenerName = _config.fullName + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event) + ":" + _config.value.toString();
   }
   else {
      sourceListenerName = _config.fullName + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event);
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

function State(_config, _owner) {
   NamedObject.call(this, { name: _config.name, type: "state" }, _owner);

   this._id = this.fullName;
   this.sourceMap = {};
   this.activeGuardedSources = [];
   this.activeGuardedActions = [];
   this.actionTimeouts = [];

   if (_config.hasOwnProperty("regEx")) {
      this.regEx = new RegExp(_config.regEx);
   }

   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : _owner.priority;

   if (_config.hasOwnProperty("source")) {
      _config.sources = [ _config.source ];
   }

   if (_config.hasOwnProperty("sources")) {
      this.sources = _config.sources;

      for (var k = 0; k < this.sources.length; ++k) {

         if (this.sources[k].hasOwnProperty('guard')) {
            this.sources[k].guards = [ this.sources[k].guard ];
         }
      }
   }

   if (_config.hasOwnProperty("action")) {
      _config.actions = [ _config.action ];
   }

   if (_config.hasOwnProperty("actions")) {
      this.actions = _config.actions;

      for (var l = 0; l < this.actions.length; ++l) {

         if (this.actions[l].hasOwnProperty('guard')) {
            this.actions[l].guards = [ this.actions[l].guard ];
         }
      }
   }

   if (_config.hasOwnProperty("actionHandler")) {
      this.actionHandler = _config.actionHandler;
   }

   if (_config.hasOwnProperty("schedule")) {
      _config.schedules = [ _config.schedule ];
   }

   if (_config.hasOwnProperty("schedules")) {
      this.schedules = _config.schedules;

      for (var x = 0; x < this.schedules.length; ++x) {

         if (this.schedules[x].hasOwnProperty('guard')) {
            this.schedules[x].guards = [ this.schedules[x].guard ];
         }
      }
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

         if (!this.sources[i].hasOwnProperty("fullName")) {
            this.sources[i].fullName = this.owner.owner.fullName;
         }

         var sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i]);
         this.sources[i].sourceListener = sourceListener;
         var val = (this.sources[i].hasOwnProperty('value')) ? this.sources[i].value : true;

         if (!this.sourceMap[sourceListener.sourceEventName]) {
            this.sourceMap[sourceListener.sourceEventName] = [];
         }

         this.sourceMap[sourceListener.sourceEventName].push(this.sources[i]);

         if (this.sources[i].hasOwnProperty("guards")) {

            for (var k = 0; k < this.sources[i].guards.length; ++k) {

               if (this.sources[i].guards[k].hasOwnProperty("property")) {
                  util.ensureExists(this.sources[i].guards[k], "value", true);
                  util.ensureExists(this.sources[i].guards[k], "active", true);

                  if (this.sources[i].guards[k].active) {
                     this.sources[i].guards[k].fullName = this.owner.owner.fullName;
                     this.sources[i].guards[k].sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i].guards[k]);
                  }
               }
               else {
                  this.sources[i].guards[k].active = false;
               }
            }
         }
      }
   }

   if (this.actions) {

      for (var l = 0; l < this.actions.length; l++) {

         if (this.actions[l].hasOwnProperty("guards")) {

            for (var m = 0; m < this.actions[l].guards.length; ++m) {

               if (this.actions[l].guards[m].hasOwnProperty("property")) {
                  util.ensureExists(this.actions[l].guards[m], "value", true);
                  util.ensureExists(this.actions[l].guards[m], "active", true);

                  if (this.actions[l].guards[m].active) {
                     this.actions[l].guards[m].fullName = this.owner.owner.fullName;
                     this.actions[l].guards[m].sourceListener = this.owner.fetchOrCreateSourceListener(this.actions[l].guards[m]);
                  }
               }
               else {
                  this.actions[l].guards[m].active = false;
               }
            }
         }
      }
   }

   if (this.schedules) {

      if (!this.scheduleService) {
         this.scheduleService =  this.owner.gang.casa.findService("scheduleservice");
      }

      if (!this.scheduleService) {
         console.error(this.fullName + ": ***** Schedule service not found! *************");
         process.exit(3);
      }

      for (var n = 0; n < this.schedules.length; n++) {

         if (this.schedules[n].hasOwnProperty("guards")) {

            for (var p = 0; p < this.schedules[n].guards.length; ++p) {
               util.ensureExists(this.schedules[n].guards[p], "value", true);
               util.ensureExists(this.schedules[n].guards[p], "active", true);

               if (this.schedules[n].guards[p].active) {
                  this.schedules[n].guards[p].fullName = this.owner.owner.fullName;
                  this.schedules[n].guards[p].sourceListener = this.owner.fetchOrCreateSourceListener(this.schedules[n].guards[p]);
               }
            }
         }
      }

      this.scheduleService.registerEvents(this, this.schedules);
   }
}

util.inherits(State, NamedObject);

State.prototype.initialise = function() {
   var immediateState = this.checkSourceProperties();

   if (!immediateState) {

      if (!this.alignActions() && this.owner.takeControlOnTransition) {
         this.owner.takeControl(this.priority);
      }
   }

   return immediateState;
};

State.prototype.processSourceEvent = function(_sourceEventName, _name, _value) {
   var sources = null;
   var source = this.checkActiveSourceGuards(_name, _value);

   if (source) {
      console.log(this.fullName+": processSourceEvent() active guard is now met");
      return source;
   }

   if (this.sourceMap[_sourceEventName]) {
      sources = (this.sourceMap[_sourceEventName]);
   }
   
   if (sources) {
      
      for (var i = 0; i < sources.length; ++i) {
         
         if (sources[i].hasOwnProperty("nextState") || sources[i].hasOwnProperty("handler")) { 
            
            if (this.checkGuard(sources[i], this.activeGuardedSources)) {
               return sources[i];
            }
         }
      }
   }
   else if (this.processActiveActionGuards(_name, _value)) {
      return null;
   }

   return null;
};

State.prototype.checkGuard = function(_guardedObject, _activeQueue) {

   if (!_guardedObject) {
      return false;
   }

   var ret = true;

   if (_guardedObject.hasOwnProperty("guards")) {

      for (var i = 0; i < _guardedObject.guards.length; ++i) {

         if (_activeQueue && _guardedObject.guards[i].active) {
            _activeQueue.push(_guardedObject);
         }

         if ((_guardedObject.guards[i].hasOwnProperty("property")) && (this.owner.owner.getProperty(_guardedObject.guards[i].property) !== _guardedObject.guards[i].value)) {
            ret = false;
            break;
         }
         else if (_guardedObject.guards[i].hasOwnProperty("previousState") && this.owner.previousState && (this.owner.previousState !== _guardedObject.guards[i].previousState)) {
           ret = false;
           break;
         }
      }
   }

   return ret;
};

State.prototype.processActiveActionGuards = function(_propName, _propValue) {
   var actionsMet = [];
   var newActionsFound = 0;

   for (var a = 0; a < this.activeGuardedActions.length; ++a) {

      for (var i = 0; i < this.activeGuardedActions[a].guards.length; ++i) {

         if (this.activeGuardedActions[a].guards[i].active && (this.activeGuardedActions[a].guards[i].property === _propName)) {

            if ((_propValue === this.activeGuardedActions[a].guards[i].value) && this.checkGuard(this.activeGuardedActions[a])) {
               console.log(this.fullName + ": checkActiveActionGuards() Found active guard! Property: "+_propName+" Value: "+_propValue);
               newActionsFound++;
               actionsMet.push(this.activeGuardedActions[a]);
            }
         }
      }
   }

   // Process met actions
   if (newActionsFound > 0) {
      this.owner.alignActions(actionsMet, this.priority);
      return true;
   }
   else {
      return false;
   }
};

State.prototype.checkActiveSourceGuards = function(_propName, _propValue) {

   for (var a = 0; a < this.activeGuardedSources.length; ++a) {

      for (var i = 0; i < this.activeGuardedSources[a].guards.length; ++i) {

         if (this.activeGuardedSources[a].guards[i].active && (this.activeGuardedSources[a].guards[i].property === _propName)) {

            if ((_propValue === this.activeGuardedSources[a].guards[i].value) && this.checkGuard(this.activeGuardedSources[a])) {
               console.log(this.fullName + ": checkActiveSourceGuards() Found active guard!");
               return this.activeGuardedSources[a];
            }
         }
      }
   }

   return null;
};

State.prototype.filterActions = function(_actions) {

   if (!_actions) {
      return null;
   }

   var newActions = [];

   for (var i = 0; i < _actions.length; ++i) {

      if (_actions[i].hasOwnProperty("delay")) {

         this.actionTimeouts.push({ action: _actions[i], timeout: setTimeout( (_index) => {

            if (this.actionTimeouts[_index].action.hasOwnProperty("handler")) {
               this.launchActionHandlers([ this.actionTimeouts[_index].action]);
            }
            this.owner.alignActions([this.actionTimeouts[_index].action], this.priority);
            this.actionTimeouts[_index] = null;

         }, _actions[i].delay*1000, this.actionTimeouts.length)});
      }
      else if (this.checkGuard(_actions[i], this.activeGuardedActions)) {
         newActions.push(_actions[i]);
      }
   }

   return newActions;
}

State.prototype.launchActionHandlers = function(_actions) {
   var propertyActions = [];

   if (!_actions) {
      return _actions;
   }

   for (var i = 0; i < _actions.length; ++i) {

      if (_actions[i].hasOwnProperty("handler")) {
         this.owner.launchActionFunction(_actions[i].handler, this.priority);
      }
      else {
         propertyActions.push(_actions[i]);
      }
   }

   return propertyActions;
};

State.prototype.alignActions = function() {
   var filteredActions = this.launchActionHandlers(this.filterActions(this.actions));
   this.owner.alignActions(filteredActions, this.priority);

   return (filteredActions && (filteredActions.length > 0));
};

State.prototype.checkSourceProperties = function() {
   var immediateNextState = null;

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (this.checkGuard(this.sources[i]) && this.sources[i].hasOwnProperty("value") && this.sources[i].hasOwnProperty("property")) {
            var sourceName = this.sources[i].hasOwnProperty("fullName") ? this.sources[i].fullName : this.owner.owner.fullName;
            var sourceEventName = sourceName + ":" + this.sources[i].property + ":" + this.sources[i].value.toString();
            var sourceListener = this.owner.sourceListeners[sourceEventName];
            var source = (sourceListener) ? sourceListener.getSource() : null;

            if (source && source.props.hasOwnProperty(this.sources[i].property) && (source.getProperty(this.sources[i].property) === this.sources[i].value)) {

               // Property already matches so move to next state immediately
               if (this.sources[i].hasOwnProperty("nextState") && (this.sources[i].nextState !== this.name)) {
                  immediateNextState = this.sources[i].nextState;
                  console.log(this.fullName+": Immediate state transition match! source="+this.sources[i].fullName+" property="+this.sources[i].property+" value="+this.sources[i].value);
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
   this.activeGuardedActions = [];

   for (var i = 0; i < this.actionTimeouts.length; ++i) {

      if (this.actionTimeouts[i]) {
         clearTimeout(this.actionTimeouts[i].timeout);
      }
   }

   this.actionTimeouts = [];
};

State.prototype.scheduledEventTriggered = function(_event) {
   console.log(this.fullName + ": scheduledEventTriggered() event name=" + _event.name);

   if (_event.hasOwnProperty("name") && (_event.name != undefined)) {

      if (_event.hasOwnProperty("value")) {
         this.owner.raiseEvent(_event.name, { sourceName: this.owner.owner.fullName, value: _event.value });
      }
      else {
         this.owner.raiseEvent(_event.name, { sourceName: this.owner.owner.fullName });
      }
   }

   if (_event.config.hasOwnProperty("nextState")) {

      if ((this.owner.currentState === this) && this.checkGuard(_event.config, this.activeGuardedSources)) {
         this.owner.set(_event.config.nextState, { sourceName: this.owner.owner.fullName });
      }
   }
   else {
      this.owner.set(this.name, { sourceName: this.owner.owner.fullName });
   }
}

module.exports = exports = StateProperty;
