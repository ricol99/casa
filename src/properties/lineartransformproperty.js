var util = require('util');
var SourceStepProperty = require('../steps/sourcestepproperty');

function LinearTransformProperty(_config, _owner) {
   _config.sourceStep = { type: 'lineartransformstep',
                          inputMin: _config.inputMin, inputMax: _config.inputMax,
                          outputMin: _config.outputMin, outputMax: _config.outputMax };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(LinearTransformProperty, SourceStepProperty);

module.exports = exports = LinearTransformProperty;
