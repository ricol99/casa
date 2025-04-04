var util = require('util');
var Thing = require('./thing');
var SourceListener = require('./sourcelistener');

/************************
{
   "name": "agent-on-holiday",
   "type": "agent",
   "displayName": "On Holiday Agent",
   "eventProp": "receivedEvent",
   "stateProp": "currentState",
   "properties": [
      {
         "name": "receivedEvent",
         "initialValue": "none"
      },
      {
         "name": "currentState",
         "initialValue": "alarm-disarmed"
      }
   ],
   "events": {
      "alarm-disarmed" : {
         "true" : [
            {
               "uName": "::dumgoyne:alarm",
               "property": "target-state",
               "value": "armed-full",
               "exitState": "alarm-armed"
            }
         ]
      },
      "alarm-armed" : {
         "false" : [
            {
               "uName": "::dumgoyne:alarm",
               "property": "target-state",
               "value": "disarmed",
               "exitState": "alarm-disarmed"
            }
         ]
      }
   }
}
*************************/

/************************
{
   "name": "brightness",
   "type": "stateproperty",
   "initialValue": "off",
   "sources": [
      {
         "uName": "::natalie",
         "property": "in-bed-at-home",
         "states": {
            "off": {
               "true": [
                  "value": "armed-full",
                  "exitState": "alarm-armed"
               ]
            }
         }
      }
      "alarm-disarmed" : {
         "true" : [
            {
               "uName": "::dumgoyne:alarm",
               "property": "target-state",
               "value": "armed-full",
               "exitState": "alarm-armed"
            }
         ]
      },
      "alarm-armed" : {
         "false" : [
            {
               "uName": "::dumgoyne:alarm",
               "property": "target-state",
               "value": "disarmed",
               "exitState": "alarm-disarmed"
            }
         ]
      }
   }
}
*************************/

function Agent(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.sourceMap = {};
   this.sourceListeners = {};
   this.eventProp = _config.hasOwnProperty("eventProp") ? _config.eventProp : "ACTIVE";

   for (var eventPropValue in _config.sourceMap) {

      if (_config.sourceMap.hasOwnProperty(eventPropValue)) {
         this.sourceMap[eventPropValue] = [];

         for (var i = 0; i < _config.sourceMap[eventPropValue].length; i++) {
            this.sourceMap[eventPropValue].push(_config.sourceMap[eventPropValue][i]);
            this.sourceMap[eventPropValue][i].ignoreSourceUpdates = true;
            this.sourceMap[eventPropValue][i].listeningSource = this.uName;

            if (!this.sourceListeners.hasOwnProperty(_config.sourceMap[eventPropValue][i].name)) {
               this.sourceListeners[_config.sourceMap[eventPropValue][i].name] = new SourceListener(this.sourceMap[eventPropValue][i], this);
            }
         }
      }
   }
}

util.inherits(Agent, Thing);

// Called when current state required
Agent.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Agent.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Agent.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

Agent.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

Agent.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {

   if ((_propertyName === this.eventProp)) {
      this.setAgentStates(_propertyValue);
   }
};

Agent.prototype.setAgentStates = function(_propertyValue) {

   if (this.sourceMap[_propertyValue]) {

      for (var i = 0; i < this.sourceMap[_propertyValue].length; ++i) {
         var sourceListener = this.sourceListeners[this.sourceMap[_propertyValue][i].name];

         if (sourceListener.isValid()) {
            sourceListener.getSource().setProperty(this.sourceMap[_propertyValue][i].property, this.sourceMap[_propertyValue][i].value, { sourceName: this.uName });
         }
      }
   }
};

Agent.prototype.sourceIsValid = function(_data) {
};

Agent.prototype.sourceIsInvalid = function(_data) {
};

module.exports = exports = Agent;
