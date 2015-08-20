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
   console.log("===============GGGGGG " + this.name, _data);
   if (_data.propertyName == this.property) {
      this.props[this.property] = _data.propertyValue;
      var a = _data.propertyValue;
      var b = this.triggerValue;
      var evalStr = "a " + this.triggerCondition + " b";

      if (this.props['ACTIVE']) {
   console.log("===============HHHHHH " + this.name, _data);

         if (!eval(evalStr)) {
   console.log("===============IIIIII " + this.name, _data);
            this.goInactive({ sourceName: this.name });
         }
      }
      else { // inactive

   console.log("===============JJJJJJ " + this.name, _data);
         if (eval(evalStr)) {
   console.log("===============KKKKKK " + this.name, _data);
            this.goActive({ sourceName: this.name });
         }
      }
   }
}

module.exports = exports = PropertyActivator;
 
