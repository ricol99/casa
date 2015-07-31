var util = require('util');
var ListeningState = require('./listeningstate');
var CasaSystem = require('./casasystem');

function PropertyState(_config) {
   this.property = _config.property;

   if (_config.triggerCondition == undefined) {
      this.triggerCondition = "==";
      this.triggerValue = (_config.triggerValue == undefined) ? true : _config.triggerValue;
   }
   else {
      this.triggerCondition = _config.triggerCondition;
      this.triggerValue = _config.triggerValue;
   }

   ListeningState.call(this, _config);

   var that = this;
}

util.inherits(PropertyState, ListeningState);

PropertyState.prototype.sourcePropertyChanged = function(_data) {

   if (_data.propertyName == this.property) {
      this.props[this.property] = _data.propertyValue;
      var a = _data.propertyValue;
      var b = this.triggerValue;
      var evalStr = "a " + this.triggerCondition + " b";

      if (this.active) {

         if (!eval(evalStr)) {
            this.goInactive({ sourceName: this.name });
         }
      }
      else { // inactive

         if (eval(evalStr)) {
            this.goActive({ sourceName: this.name });
         }
      }
   }
}

module.exports = exports = PropertyState;
 
