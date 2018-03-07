var util = require('util');
var SourceStepProperty = require('../steps/sourcestepproperty');

function CameraProperty(_config, _owner) {

   _config.sourceStep = { type: 'camerastep',
                          cctvHostname: _config.cctvHostname, cctvPort: _config.cctvPort,
                          userId: _config.userId, password: _config.password, cameraId: _config.cameraId };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(CameraProperty, SourceStepProperty);

module.exports = exports = CameraProperty;
