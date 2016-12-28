var http = require('http');
var util = require('util');
var PropertyBinder = require('./propertybinder');

function SpyCameraBinder(_config, _owner) {

   this.options = { hostname: _config.cctvHostname, port: _config.cctvPort, auth: _config.userId + ':' + _config.password };
   this.id = _config.cameraId;

   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

SpyCameraBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data) {
   console.log(this.name + ': received property change, property='+ _data.sourcePropertyName + ' value=' + _data.propertyValue);

   // https active request
   if (_data.propertyValue) {
      this.options.path = '/++ssControlActiveMode?cameraNum=' + this.id;
   }
   else {
      this.options.path = '/++ssControlPassiveMode?cameraNum=' + this.id;
   }

   http.get(this.options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      return _callback(null, _data.propertyValue);
   }).on('error', function(e) {
      console.log("Got error: " + e.message);
      return _callback(e, null);
   });
}


util.inherits(SpyCameraBinder, PropertyBinder);

module.exports = exports = SpyCameraBinder;
