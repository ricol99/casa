var http = require('http');
var util = require('util');
var Thing = require('../thing');

function Camera(_config) {

   this.options = { hostname: _config.cctvHostname, port: _config.cctvPort, auth: _config.userId + ':' + _config.password };
   this.id = _config.cameraId;

   Thing.call(this, _config);

   var that = this;
}

util.inherits(Camera, Thing);

Camera.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ': received property change, property='+ _data.sourcePropertyName + ' value=' + _data.value);

   // https active request
   if (_propValue) {
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
}

module.exports = exports = Camera;
