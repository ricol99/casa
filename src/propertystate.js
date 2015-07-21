var util = require('util');
var State = require('./state');

function PropertyState(_config) {
   this.triggerProperty = _config.triggerProperty;

   if (_config.triggerCondition == undefined) {
      this.triggerCondition = "==";
      this.triggerValue = (_config.triggerValue == undefined) ? true : _config.triggerValue;
      this.triggerInitialValue = (_config.triggerInitialValue == undefined) ? !this.triggerValue : _config.triggerValue;
   }
   else {
      this.triggerCondition = _config.triggerCondition;
      this.triggerValue = _config.triggerValue;
      this.triggerInitialValue = _config.triggerValue;
   }

   State.call(this, _config);

   this.props[this.triggerProperty] = this.triggerInitialValue;

   var that = this;
}

util.inherits(PropertyState, State);

PropertyState.prototype.setProperty = function(_propName, _propValue, _callback) {
   this.props[_propName] = _propValue;

   if (_propName == this.triggerProperty) {
      var a = this.props[this.triggerProperty];
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
   _callback(true);
}

module.exports = exports = PropertyState;
 
