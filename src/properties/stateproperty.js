var util = require('util');
var Property = require('../property');

/************************
{
   "name": "user-state",
   "type": "stateproperty",
   "initialValue": "no-users-present",
   "states": [
      {
         "name": "DEFAULT",
         "sources": [
            {
               "event": "wake-up-started",
               "nextState": {
                  "name": "users-waking-up"
               }
            },
            {
               "event": "wake-up-finished",
               "nextState": {
                  "name": "users-present"
               }
            }
         ]
      },
      {
         "name": "no-users-present",
         "source": {
            "property": "movement",
            "nextStates": [
               {
                  "name": "users-present",
                  "value": true
               }
            ]
         }
      },
      {
         "name": "users-present",
         "sources": [
            {
               "property": "movement",
               "nextStates": [
                  {
                     "name": "no-users-present",
                     "value": false
                  }
               ]
            },
            {
               "event": "natalie-bed-switch",
               "nextstate": {
                  "name": "natalie-reading"
               }
            },
            {
               "event": "richard-bed-switch",
               "nextstate": {
                  "name": "richard-reading"
               }
            }
         ]
      },
      {
         "name": "natalie-reading",
         "sources": [
            {
               "event": "natalie-bed-switch",
               "nextstate": {
                  "name": "natalie-asleep"
               }
            },
            {
               "event": "richard-bed-switch",
               "nextstate": {
                  "name": "both-reading"
               }
            }
         ]
      },
      {
         "name": "richard-reading",
         "sources": [
            {
               "event": "richard-bed-switch",
               "nextstate": {
                  "name": "richard-asleep"
               }
            },
            {
               "event": "natalie-bed-switch",
               "nextstate": {
                  "name": "both-reading"
               }
            }
         ]
      },
      {
         "name": "both-reading",
         "sources": [
            {
               "event": "natalie-bed-switch",
               "nextstate": {
                  {
                     "name": "richard-reading-natalie-asleep"
                  }
               ]
            },
            {
               "event": "richard-bed-switch",
               "nextstate": {
                  "name": "natalie-reading-richard-asleep"
               }
            }
         ]
      }
      {
         "name": "richard-reading-natalie-asleep",
         "sources": [
            {
               "event": "natalie-bed-switch",
               "nextstate": {
                  "name": "both-reading"
               }
            },
            {
               "event": "richard-bed-switch",
               "nextstate": {
                  "name": "both-asleep"
               }
            }
         ]
      },
      {
         "name": "natalie-reading-richard-asleep",
         "sources": [
            {
               "event": "natalie-bed-switch",
               "nextstate": {
                  "name": "both-asleep"
               }
            },
            {
               "event": "richard-bed-switch",
               "nextstate": {
                  "name": "both-reading"
               }
            }
         ]
      }
   ]
}

*************************/

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.sourceListeners = {};
   this.states = {};

   for (var stateName in _config.states) {

      if (_config.states.hasOwnProperty(stateName)) {
         this.states[stateName] = new State(_config.states[stateName], this);
      }
   }
}

util.inherits(StateProperty, Thing);

StateProperty.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {
   var currentState = this.states[this.value];
   var nextState = null;

   if (currentState && currentState.sourceMap[_data.sourceEventName]) {
      nextState = this.findNextState(currentState, _propertyValue);
   }

   if (!nextState && this.states["DEFAULT"] && this.states["DEFAULT"].sourceMap[_data.sourceEventName]) {
      nextState = this.findNextState(this.states["DEFAULT"], _propertyValue);
   }

   if (nextState) {
      this.updatePropertyInternal(nextState);
   }
};

StateProperty.prototype.findNextState = function(_state, _propertyValue) {

   for (var i = 0; i < _state.sources.length, ++i) {

      if (_state.sources[i].hasOwnProperty("value")) {

         if (_state.sources[i].value == _propertyValue) {
            return _state.sources[i].nextState;
         }
      }
      else {
         return _state.sources[i].nextState;
      }
   }

   return undefined;
};

StateProperty.prototype.sourceIsValid = function(_data) {
};

StateProperty.prototype.sourceIsInvalid = function(_data) {
};

StateProperty.prototype.fetchOrCreateSourceListener = function(_config) {
   var sourceListenerName = _config.name + ":" + (_config.hasOwnProperty("property")) ? _config.property : _config.event;
   var sourceListener = this.sourceListeners[sourceListenerName];

   if (!sourceListener) {
      this.config.uName = _config.name;
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

   for (var i = 0; i < this.sources.length; i++) {

      if (!this.sources[i].hasOwnProperty("name")) {
         this.sources[i].name = this.owner.owner.uName;
      }

      var this.sources[i].sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i]);
      this.sourceMap[sourceListener.sourceEventName] = this.sources[i];
   }
}

module.exports = exports = StateProperty;
