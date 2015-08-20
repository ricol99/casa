var util = require('util');
var Worker = require('./worker');

function Transform(_config) {

   Worker.call(this, _config);

   this.targetProperty = _config.targetProperty;
   var that = this;
}

util.inherits(Transform, Worker);

Transform.prototype.sourcePropertyChanged = function(_data) {
   // DO NOTHING BY DEFAULT
}

Transform.prototype.setTargetProperty = function(_propertyValue, _data) {
   var that = this;

   _data["sourceName"] = this.name;

   this.target.setProperty(this.targetProperty, _propertyValue, _data, function(_result) {

      if (!_result) {
         console.log(that.name + ': Unable to set property ' + that.targetProperty + ' to value ' + _propertyValue);
      }
   });
}

module.exports = exports = Transform;

