var util = require('util');
var StepProperty = require('./stepproperty');

function OutputStepProperty(_config, _owner) {

   if (_config.outputSteps == undefined) {
      _config.outputSteps = [ _config.outputStep ];
   }
   else {
      _config.outputSteps.push(_config.outputStep);
   }

   StepProperty.call(this, _config, _owner);
}

util.inherits(OutputStepProperty, StepProperty);

module.exports = exports = OutputStepProperty;
