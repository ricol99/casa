var util = require('util');
var ListeningSource = require('./listeningsource');
var CasaSystem = require('./casasystem');

function PropertyActivator(_config) {
   this.property = _config.property;
   this.sourceActive = false;

   if (_config.triggerCondition == undefined) {
      this.triggerCondition = "==";
      this.triggerValue = (_config.triggerValue == undefined) ? true : _config.triggerValue;
   }
   else {
      this.triggerCondition = _config.triggerCondition;
      this.triggerValue = _config.triggerValue;
   }

   ListeningSource.call(this, _config);

   var that = this;
}

util.inherits(PropertyActivator, ListeningSource);

PropertyActivator.prototype.sourcePropertyChanged = function(_data) {

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

module.exports = exports = PropertyActivator;
 
