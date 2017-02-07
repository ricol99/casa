var http = require('http');
var util = require('util');
var Step = require('./thing');

function Camera(_config, _pipeline) {

   this.options = { hostname: _config.cctvHostname, port: _config.cctvPort, auth: _config.userId + ':' + _config.password };
   this.id = _config.cameraId;

   Step.call(this, _config, _pipeline);
}

util.inherits(Camera, Step);

Camera.prototype.process = function(_value, _data) {
   console.log(this.type + ': received property change, property='+ _data.sourcePropertyName + ' value=' + _value);

   // https active request
   if (_value) {
      this.options.path = '/++ssControlActiveMode?cameraNum=' + this.id;
   }
   else {
      this.options.path = '/++ssControlPassiveMode?cameraNum=' + this.id;
   }

   http.get(this.options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
   }).on('error', function(e) {
      console.log("Got error: " + e.message);
   });

   this.outputForNextStep(_value, _data);
}

module.exports = exports = Camera;
