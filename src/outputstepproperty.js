var util = require('util');
var Property = require('./property');

function OutputStepProperty(_config, _owner) {

   if (_config.outputSteps == undefined) {
      _config.outputSteps = [ _config.outputStep ];
   }
   else {
      _config.outputSteps.unshift(_config.outputStep);
   }

   Property.call(this, _config, _owner);
}

util.inherits(OutputStepProperty, Property);

module.exports = exports = OutputStepProperty;
