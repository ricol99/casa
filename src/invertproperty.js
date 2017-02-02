var util = require('util');
var SourceStepProperty = require('./sourcestepproperty');

function InvertProperty(_config, _owner) {
   _config.sourceStep = { type: 'invertstep' };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(InvertProperty, SourceStepProperty);

module.exports = exports = InvertProperty;
