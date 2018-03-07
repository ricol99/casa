var util = require('util');
var SourceStepProperty = require('../steps/sourcestepproperty');

function ThresholdProperty(_config, _owner) {

   _config.sourceStep = { type: 'thresholdstep', threshold: _config.threshold,
                          thresholds: _config.thresholds, buffer: _config.buffer };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(ThresholdProperty, SourceStepProperty);

module.exports = exports = ThresholdProperty;
