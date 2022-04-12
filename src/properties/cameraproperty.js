var util = require('util');
var Property = require('../property');
var http = require('http');

function CameraProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.options = { hostname: _config.cctvHostname, port: _config.cctvPort, auth: _config.userId + ':' + _config.password };
   this.id = _config.cameraId;
}

util.inherits(CameraProperty, Property);

// Called when current state required
CameraProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to retsore current state
CameraProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

CameraProperty.prototype.coldStart = function() {
   Property.prototype.coldStart.call(this);
};

CameraProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};
CameraProperty.prototype.propertyAboutToChange = function(_newValue, _data) {
   console.log(this.uName + ': Property about to change to ' + _newValue);

   // https active request
   if (_newValue) {
      this.options.path = '/++ssControlActiveMode?cameraNum=' + this.id;
   }
   else {
      this.options.path = '/++ssControlPassiveMode?cameraNum=' + this.id;
   }

   http.get(this.options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
   }).on('error', (e) => {
      console.log(this.uName + ": Received error: " + e.message);
   });
}

module.exports = exports = CameraProperty;
