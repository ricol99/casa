var util = require('util');
var Property = require('./property');

function SourceStepProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   var Step = require('./'+_config.sourceStep.type);
   _config.sourceStep.sourceStep = true;
   this.sourceStep = new Step(_config.sourceStep);
}

util.inherits(SourceStepProperty, Property);

SourceStepProperty.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   sourceStep.process = function(_data.propertyValue, _data) {
}

module.exports = exports = SourceStepProperty;
