var util = require('util');
var StepProperty = require('./stepproperty');

function SourceStepProperty(_config, _owner) {

   if (_config.sourceSteps == undefined) {
      _config.sourceSteps = [ _config.sourceStep ];
   }
   else {
      _config.sourceSteps.unshift(_config.sourceStep);
   }

   StepProperty.call(this, _config, _owner);
}

util.inherits(SourceStepProperty, StepProperty);

module.exports = exports = SourceStepProperty;
