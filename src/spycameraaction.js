var http = require('http');
var util = require('util');
var Action = require('./action');

function SpyCameraAction(_config) {

   this.options = { hostname: _config.cctvHostname, port: _config.cctvPort, auth: _config.userId + ':' + _config.password };
   this.id = _config.cameraId;

   Action.call(this, _config);

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      // https active request
      that.options.path = '/++ssControlActiveMode?cameraNum=' + that.id;

      http.get(that.options, function(res) {
         console.log('STATUS: ' + res.statusCode);
         console.log('HEADERS: ' + JSON.stringify(res.headers));
         that.emit('activated', { sourceName: that.name });
      }).on('error', function(e) {
         console.log("Got error: " + e.message);
      });
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      // https passive request
      that.options.path = '/++ssControlPassiveMode?cameraNum=' + that.id;

      http.get(that.options, function(res) {
         console.log('STATUS: ' + res.statusCode);
         console.log('HEADERS: ' + JSON.stringify(res.headers));
         that.emit('deactivated', { sourceName: that.name });
      }).on('error', function(e) {
         console.log("Got error: " + e.message);
      });
   });
}

util.inherits(SpyCameraAction, Action);

module.exports = exports = SpyCameraAction;
