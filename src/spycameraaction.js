var http = require('http');
var util = require('util');
var Action = require('./action');

function SpyCameraAction(_config) {

   this.options = { hostname: _config.cctvHostname, port: _config.cctvPort, auth: _config.userId + ':' + _config.password };
   this.id = _config.cameraId;

   Action.call(this, _config);

   var that = this;

   function activated() {
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
   }

   function deactivated() {
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
   }

   this.on('activated', function () {
      activated();
   });

   this.on('activated-from-cold', function () {
      activated();
   });

   this.on('deactivated', 'deactivated-from-cold', function () {
      deactivated();
   });

   this.on('deactivated-from-cold', function () {
      deactivated();
   });
}

util.inherits(SpyCameraAction, Action);

module.exports = exports = SpyCameraAction;
