var util = require('util');
var Property = require('./property');

function SourceStepProperty(_config, _owner) {

   if (_config.sourceSteps == undefined) {
      _config.sourceSteps = [ _config.sourceStep ];
   }
   else {
      _config.sourceSteps.unshift(_config.sourceStep);
   }

   Property.call(this, _config, _owner);
}

util.inherits(SourceStepProperty, Property);

module.exports = exports = SourceStepProperty;
