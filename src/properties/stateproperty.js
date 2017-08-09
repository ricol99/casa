var util = require('util');
var Property = require('../property');
var SourceListener = require('../sourcelistener');
var CasaSystem = require('../casasystem');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.states = {};

   for (var i = 0; i < _config.states.length; ++i) {
      this.states[_config.states[i].name] = new State(_config.states[i], this);
   }

   this.setState(this.value);
}

util.inherits(StateProperty, Property);

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

   if (source) {

      if (source.hasOwnProperty("nextState")) {
         this.set(this.transformNextState(source.nextState), { sourceName: this.owner });
      }
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

   if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
   }

   this.previousState = this.value;

   if (this.states[_nextState]) {

      if (this.states[_nextState].timeout) {

         this.stateTimer = setTimeout(function(_this, _timeoutState) {
            _this.stateTimer = null;
            _this.set(_this.transformNextState(_timeoutState), { sourceName: _this.owner });
         }, this.states[_nextState].timeout.duration * 1000, this, this.states[_nextState].timeout.nextState);
      }

      if (this.states[_nextState].guardsComply()) {
         this.alignTargetProperties(this.states[_nextState]);
      }
   }
   else if (this.states["DEFAULT"]) {
      this.alignTargetProperties(this.states["DEFAULT"]);
   }
};

StateProperty.prototype.alignTargetProperties = function(_state) {

   if (_state.targets) {
      var targets = [];

      for (var i = 0; i < _state.targets.length; ++i) {

         if (_state.targets[i].hasOwnProperty("value")) {
            targets.push(_state.targets[i]);
         }
         else if (_state.targets[i].hasOwnProperty("ramp")) {
            var rampConfig = copyObject(_state.targets[i].ramp);

            if (!(rampConfig.hasOwnProperty("startValue"))) {
               rampConfig.startValue = this.owner.props[_state.targets[i].property].value;
            }

            rampConfig.property = _state.targets[i].property;

            if (!this.rampService) {
               var casaSys = CasaSystem.mainInstance();
               this.rampService =  casaSys.findService("rampservice");

               if (!this.rampService) {
                  console.error(this.uName + ": ***** Ramp service not found! *************");
                  process.exit();
               }
            }

            var ramp = this.rampService.createRamp(this, rampConfig);
            ramp.start();
         }
      }

      if (targets.length > 0) {
         this.owner.setNextProperties(_state.targets);
      }
   }
};

StateProperty.prototype.newValueFromRamp = function(_ramp, _config, _value) {
   this.owner.setNextPropertyValue(_config.property, _value);
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

   this.sources = _config.sources;
   this.targets = _config.hasOwnProperty("targets") ? _config.targets : (_config.hasOwnProperty("target") ? [ _config.target ] : undefined);
   this.schedules = _config.hasOwnProperty("schedules") ? _config.schedules : (_config.hasOwnProperty("schedule") ? [ _config.schedule ] : undefined);
   this.guards = _config.hasOwnProperty("guards") ? _config.guards : (_config.hasOwnProperty("guard") ? [ _config.guard ] : undefined);
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
         var casaSys = CasaSystem.mainInstance();
         this.scheduleService =  casaSys.findService("scheduleservice");
      }

      if (!this.scheduleService) {
         console.error(this.uName + ": ***** Schedule service not found! *************");
         process.exit();
      }

      this.scheduleService.registerEvents(this, this.schedules);
   }
}


State.prototype.guardsComply = function() {
   var ret = true;

   if (this.guards) {

      for (var i = 0; i < this.guards.length; ++i) {

         if (this.guards[i].value != this.owner.owner.props[this.guards[i].property]) {
            ret = false;
            break;
         }
      }
   }

   return ret;
}

State.prototype.scheduledEventTriggered = function(_event, _value) {
   console.log(this.uName+": AAAA event="+_event+" value="+_value);
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
