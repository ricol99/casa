var util = require('util');
var Transform = require('./transform');

function FanTransform(_config) {
   this.targetProperties = _config.targetProperties;

   Transform.call(this, _config);

   var that = this;
}

util.inherits(FanTransform, Transform);

FanTransform.prototype.sourcePropertyChanged = function(_data) {
   console.log(this.name + ': property ' + _data.propertyName + ' has changed to ' + _data.propertyValue);

   if (this.target) {
      this.setTargetProperties(_data.propertyValue);
   }
}

FanTransform.prototype.setTargetProperties = function(_propertyValue) {
   var that = this;
   var callbacks = [];

   for (var i = 0; i < this.targetProperties.length; ++i) {
      callbacks.push(function(_result) {

         if (!_result) {
            console.log(that.name + ': Unable to set property to value ' + _propertyValue);
         }
      });
      this.target.setProperty(this.targetProperties[i], _propertyValue, callbacks[i]);
   }
}


module.exports = exports = FanTransform;

