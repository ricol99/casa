var util = require('util');
var Thing = require('./thing');
var SourceListener = require('./sourcelistener');

/************************
{
   "name": "agent:on-holiday",
   "displayName": "On Holiday Agent",
   "props": [
      {
         "name": "ACTIVE",
         "type": "scheduleproperty",
         "initialValue": false,
         "writable": false,
         "events": [
            {
               "rule": "0,5,10,15,20,25,30,35,40,45,50,55 * * * *",
               "propertyValue": true
            },
            {
               "rule": "4,9,14,19,24,29,34,39,44,49,54,59 * * * *",
               "propertyValue": false
            }
         ]
      }
   ],
   "sourceMap": {
      "true" : [
         {
            "name": "alarmtexecom:dumgoyne",
            "property": "target-state",
            "value": "armed-full"
         }
      ],
      "false" : [
         {
            "name": "alarmtexecom:dumgoyne",
            "property": "target-state",
            "value": "disarmed"
         }
      ]
   }
}
*************************/

function Agent(_config) {
   Thing.call(this, _config);

   this.sourceMap = {};
   this.sourceListeners = {};
   this.agentProp = _config.hasOwnProperty("agentProp") ? _config.agentProp : "ACTIVE";

   for (var agentPropValue in _config.sourceMap) {

      if (_config.sourceMap.hasOwnProperty(agentPropValue)) {
         this.sourceMap[agentPropValue] = [];

         for (var i = 0; i < _config.sourceMap[agentPropValue].length; i++) {
            this.sourceMap[agentPropValue].push(_config.sourceMap[agentPropValue][i]);
            this.sourceMap[agentPropValue][i].ignoreSourceUpdates = true;

            if (!this.sourceListeners.hasOwnProperty(_config.sourceMap[agentPropValue][i].name)) {
               this.sourceListeners[_config.sourceMap[agentPropValue][i].name] = new SourceListener(this.sourceMap[agentPropValue][i], this);
            }
         }
      }
   }
}

util.inherits(Agent, Thing);

Agent.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {

   if ((_propertyName === this.agentProp)) {
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
