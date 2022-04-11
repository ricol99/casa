var util = require('util');
var NamedObject = require('./namedobject');

function State(_config, _owner) {
   NamedObject.call(this, { name: _config.name, type: "state" }, _owner);

   this._id = this.uName;
   this.sourceMap = {};
   this.activeGuardedSources = [];
   this.activeGuardedActions = [];
   this.actionTimeouts = [];

   if (_config.hasOwnProperty("regEx")) {
      this.regEx = new RegExp(_config.regEx);
   }

   this.priorityDefined = _config.hasOwnProperty('priority') || _owner.priorityDefined;
   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : _owner.priority;

   if (_config.hasOwnProperty("guard")) {
      _config.guards = [ _config.guard ];
   }

   if (_config.hasOwnProperty("guards")) {
      this.guards = _config.guards;
   }

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
      else if (this.timeout.hasOwnProperty("source")) {
         util.ensureExists(this.timeout.source, "uName", this.owner.owner.uName);
         this.timeout.source.sourceListener = this.owner.fetchOrCreateSourceListener(this.timeout.source);
      }
   }

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (!this.sources[i].hasOwnProperty("uName")) {
            this.sources[i].uName = this.owner.owner.uName;
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
                     this.sources[i].guards[k].uName = this.owner.owner.uName;
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
                     this.actions[l].guards[m].uName = this.owner.owner.uName;
                     this.actions[l].guards[m].sourceListener = this.owner.fetchOrCreateSourceListener(this.actions[l].guards[m]);
                  }
               }
               else {
                  this.actions[l].guards[m].active = false;
               }
            }
         }
         else if (this.actions[l].hasOwnProperty("source")) {
            util.ensureExists(this.actions[l].source, "uName", this.owner.owner.uName);
            this.actions[l].source.sourceListener = this.owner.fetchOrCreateSourceListener(this.actions[l].source);
         }
      }
   }

   if (this.schedules) {

      if (!this.scheduleService) {
         this.scheduleService =  this.owner.gang.casa.findService("scheduleservice");
      }

      if (!this.scheduleService) {
         console.error(this.uName + ": ***** Schedule service not found! *************");
         process.exit(3);
      }

      for (var n = 0; n < this.schedules.length; n++) {

         if (this.schedules[n].hasOwnProperty("guards")) {

            for (var p = 0; p < this.schedules[n].guards.length; ++p) {
               util.ensureExists(this.schedules[n].guards[p], "value", true);
               util.ensureExists(this.schedules[n].guards[p], "active", true);

               if (this.schedules[n].guards[p].active) {
                  this.schedules[n].guards[p].uName = this.owner.owner.uName;
                  this.schedules[n].guards[p].sourceListener = this.owner.fetchOrCreateSourceListener(this.schedules[n].guards[p]);
               }
            }
         }
      }

      this.scheduleService.registerEvents(this, this.schedules);
   }
}

util.inherits(State, NamedObject);

// Used to classify the type and understand where to load the javascript module
State.prototype.superType = function(_type) {
   return "state";
};

// Called when system state is required
State.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   _exportObj.priority = this.priority;
   _exportObj.activeGuardedSources = [];

   for (var i = 0; i < this.activeGuardedSources.length; ++i) {
      _exportObj.activeGuardedSources.push(this.activeGuardedSources[i]);
   }

   _exportObj.activeGuardedActions = [];

   for (var j = 0; j < this.activeGuardedActions.length; ++j) {
      _exportObj.activeGuardedActions.push(this.activeGuardedActions[j]);
   }

   _exportObj.actionTimeouts = util.copyMatch(this.actionTimeouts, (_source, _prop) => {
      return (_prop === "timeout" ) ? { replace: _source.timeout ? _source.timeout.left() : -1 } : true;
   }); 

};

// Called before hotStart to restore system state
State.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
   this.priority = _importObj.priority;

   for (var i = 0; i < _importObj.activeGuardedSources.length; ++i) {
      this.activeGuardedSources.push(_importObj.activeGuardedSources[i]);
   }

   for (var j = 0; j < _importObj.activeGuardedActions.length; ++j) {
      this.activeGuardedActions.push(_importObj.activeGuardedActions[j]);
   }

   for (var k = 0; k < _importObj.actionTimeouts.length; ++k) {
      this.actionTimeouts.push(_importObj.actionTimeouts[k]);
   }
};

State.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);

   for (var i = 0; i < this.actionTimeouts.length; ++i) {

      if (this.actionTimeouts[i]) {

         this.actionTimeouts[i].timeout = util.setTimeout( (_index) => {

            if (this.actionTimeouts[_index].action.hasOwnProperty("handler")) {
               this.launchActionHandlers([ this.actionTimeouts[_index].action]);
            }

            this.owner.alignActions([this.actionTimeouts[_index].action], this.priority);
            this.actionTimeouts[_index] = null;

         }, this.actionTimeouts[i].timeout, this.actionTimeouts.length-1);
      }
   }
};

State.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
   /// AAAAAA - TODO
};

State.prototype.getCasa = function() {
   return this.owner.getCasa();
};

State.prototype.initialise = function(_parentPropertyPriorityDefined, _parentPropertyPriority) {
   var immediateState = this.checkStateGuards() || this.checkSourceProperties();

   if (!immediateState) {

      if (_parentPropertyPriorityDefined && !this.priorityDefined) {
         this.priority = _parentPropertyPriority
      }

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
      console.log(this.uName+": processSourceEvent() active guard is now met");
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
   else {
      this.processActiveActionGuards(_name, _value);
      this.processActionsWithSources(_sourceEventName, _name, _value);
      this.processTimeoutWithSource(_sourceEventName, _value);
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
               console.log(this.uName + ": checkActiveActionGuards() Found active guard! Property: "+_propName+" Value: "+_propValue);
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

State.prototype.processActionsWithSources = function(_sourceEventName, _propName, _propValue) {

   if (this.actions) {

      for (var a = 0; a < this.actions.length; ++a) {

         if (this.actions[a].hasOwnProperty("source") && (this.actions[a].source.sourceListener.sourceEventName === _sourceEventName)) {
            this.actions[a].value = _propValue;
            this.owner.alignActions([ this.actions[a] ], this.priority);
         }
      }
   }
};

State.prototype.processTimeoutWithSource = function(_sourceEventName, _timeout) {

   if (this.timeout && this.timeout.hasOwnProperty("source") && (this.timeout.source.sourceListener.sourceEventName === _sourceEventName)) {
      this.owner.resetStateTimer(this);
   }
};

State.prototype.checkActiveSourceGuards = function(_propName, _propValue) {

   for (var a = 0; a < this.activeGuardedSources.length; ++a) {

      for (var i = 0; i < this.activeGuardedSources[a].guards.length; ++i) {

         if (this.activeGuardedSources[a].guards[i].active && (this.activeGuardedSources[a].guards[i].property === _propName)) {

            if ((_propValue === this.activeGuardedSources[a].guards[i].value) && this.checkGuard(this.activeGuardedSources[a])) {
               console.log(this.uName + ": checkActiveSourceGuards() Found active guard!");
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

         this.actionTimeouts.push({ action: _actions[i], timeout: util.setTimeout( (_index) => {

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

State.prototype.checkStateGuards = function() {
   var immediateNextState = null;

   if (this.guards) {

      for (var i = 0; i < this.guards.length; i++) {

         if (this.checkGuard({ guards: [ this.guards[i] ] }) && this.guards[i].hasOwnProperty("nextState")) {

            // Property already matches so move to next state immediately
            if (this.sources[i].hasOwnProperty("nextState") && (this.sources[i].nextState !== this.name)) {
               immediateNextState = this.guards[i].nextState;
               console.log(this.uName+": Immediate state transition required as guard has matched! Property="+this.guards[i].property+" value="+this.guards[i].value+", nextState="+immediateNextState);
               break;
            }
         }
      }
   }

   return immediateNextState;
};

State.prototype.checkSourceProperties = function() {
   var immediateNextState = null;

   if (this.sources) {

      for (var i = 0; i < this.sources.length; i++) {

         if (this.checkGuard(this.sources[i]) && this.sources[i].hasOwnProperty("value") && this.sources[i].hasOwnProperty("property")) {
            var sourceName = this.sources[i].hasOwnProperty("uName") ? this.sources[i].uName : this.owner.owner.uName;
            var sourceEventName = sourceName + ":" + this.sources[i].property + ":" + this.sources[i].value.toString();
            var sourceListener = this.owner.sourceListeners[sourceEventName];
            var source = (sourceListener) ? sourceListener.getSource() : null;

            if (source && source.properties.hasOwnProperty(this.sources[i].property) && (source.getProperty(this.sources[i].property) === this.sources[i].value)) {

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
   this.activeGuardedActions = [];

   for (var i = 0; i < this.actionTimeouts.length; ++i) {

      if (this.actionTimeouts[i]) {
         util.clearTimeout(this.actionTimeouts[i].timeout);
         this.actionTimeouts[i].timeout = null;
      }
   }

   this.actionTimeouts = [];
};

State.prototype.scheduledEventTriggered = function(_event) {
   console.log(this.uName + ": scheduledEventTriggered() event name=" + _event.name);

   if (_event.hasOwnProperty("name") && (_event.name != undefined)) {

      if (_event.hasOwnProperty("value")) {
         this.owner.raiseEvent(_event.name, { sourceName: this.owner.owner.uName, value: _event.value });
      }
      else {
         this.owner.raiseEvent(_event.name, { sourceName: this.owner.owner.uName });
      }
   }

   if (_event.config.hasOwnProperty("nextState")) {

      if ((this.owner.currentState === this) && this.checkGuard(_event.config, this.activeGuardedSources)) {
         this.owner.set(_event.config.nextState, { sourceName: this.owner.owner.uName });
      }
   }
   else {
      this.owner.set(this.name, { sourceName: this.owner.owner.uName });
   }
}

module.exports = exports = State;
