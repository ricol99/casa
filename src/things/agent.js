var util = require('util');
var Thing = require('./thing');
var SourceListener = require('./sourcelistener');

{
   "name": "room:master-bedroom",
   "initialScene": "scene:master-bedroom-vacant",
   "scenes": [
      {
         "name": "scene:master-bedroom-vacant",
         "sources": [
            {
               "name": "user:natalie",
               "property": "in-bed",
               "value": false,
               "nextScenes": [
                  {
                     "name": "scene:master-bedroom-natalie-reading",
                     "value": true
                  }
               ]
            },
            {
               "name": "user:richard",
               "property": "in-bed",
               "value": false,
               "nextScenes": [
                  {
                     "name": "scene:master-bedroom-richard-reading",
                     "value": true
                  }
               ]
            }
         ]
      },
      {
         "name": "scene:master-bedroom-natalie-reading",
         "sources": [
            {
               "name": "room:master-bedroom",
               "event": "natalie-bed-switch",
               "nextscenes": [
                  {
                     "name": "scene:master-bedroom-asleep",
                  }
               ]
            },
            {
               "name": "user:richard",
               "property": "in-bed",
               "value": false,
               "nextscenes": [
                  {
                     "name": "scene:master-bedroom-both-reading",
                     "value": true
                  }
               ]
            }
         ]
      },
      {
         "name": "scene:master-bedroom-both-reading",
         "sources": [
            {
               "name": "room:master-bedroom",
               "event": "natalie-bed-switch",
               "nextscenes": [
                  {
                     "name": "scene:master-bedroom-richard-reading-natalie-asleep",
                  }
               ]
            },
            {
               "name": "room:master-bedroom",
               "event": "richard-bed-switch",
               "nextscenes": [
                  {
                     "name": "scene:master-bedroom-natalie-reading-richard-asleep",
                     "value": true
                  }
               ]
            }
         ]
      }
      {
         "name": "scene:master-bedroom-natalie-reading",
         "sources": [
            {
               "name": "room:master-bedroom",
               "event": "natalie-bed-switch",
               "nextscenes": [
                  {
                     "name": "scene:master-bedroom-asleep",
                  }
               ]
            },
            {
               "name": "user:richard",
               "property": "in-bed",
               "value": false,
               "nextscenes": [
                  {
                     "name": "scene:master-bedroom-both-reading",
                     "value": true
                  }
               ]
            }
         ]
      },
      {
         "name": "room:master-bedroom",
         "event": "natalie-bed-switch",
         "states": {
            "on-in-bed-reading": {
               "maxTime": 900,
               "do": {
                  "value": 0,
                  "exitState": "off-in-bed-sleeping"
               },
               "timeout": {
                  "value": 0,
                  "exitState": "off-in-bed-sleeping"
               }
            },
            "off-in-bed-sleeping": {
               "do": {
                  "value": 50, 
                  "exitState": "on-in-bed-reading"
               }
            }
         }
      }
   }
}


/************************
{
   "name": "agent:on-holiday",
   "displayName": "On Holiday Agent",
   "eventProp": "receivedEvent",
   "stateProp": "currentState",
   "props": [
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
               "name": "alarmtexecom:dumgoyne",
               "property": "target-state",
               "value": "armed-full",
               "exitState": "alarm-armed"
            }
         ]
      },
      "alarm-armed" : {
         "false" : [
            {
               "name": "alarmtexecom:dumgoyne",
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
         "name": "user:natalie",
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
               "name": "alarmtexecom:dumgoyne",
               "property": "target-state",
               "value": "armed-full",
               "exitState": "alarm-armed"
            }
         ]
      },
      "alarm-armed" : {
         "false" : [
            {
               "name": "alarmtexecom:dumgoyne",
               "property": "target-state",
               "value": "disarmed",
               "exitState": "alarm-disarmed"
            }
         ]
      }
   }
}
*************************/

function Agent(_config) {
   Thing.call(this, _config);

   this.sourceMap = {};
   this.sourceListeners = {};
   this.eventProp = _config.hasOwnProperty("eventProp") ? _config.eventProp : "ACTIVE";

   for (var eventPropValue in _config.sourceMap) {

      if (_config.sourceMap.hasOwnProperty(eventPropValue)) {
         this.sourceMap[eventPropValue] = [];

         for (var i = 0; i < _config.sourceMap[eventPropValue].length; i++) {
            this.sourceMap[eventPropValue].push(_config.sourceMap[eventPropValue][i]);
            this.sourceMap[eventPropValue][i].ignoreSourceUpdates = true;

            if (!this.sourceListeners.hasOwnProperty(_config.sourceMap[eventPropValue][i].name)) {
               this.sourceListeners[_config.sourceMap[eventPropValue][i].name] = new SourceListener(this.sourceMap[eventPropValue][i], this);
            }
         }
      }
   }
}

util.inherits(Agent, Thing);

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
