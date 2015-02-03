var http = require('http');
var util = require('util');
var Action = require('./action');

function SpyCameraAction(_name, _hostname, _port, _user, _password, _cameraId, _activator, _thing) {
   this.options = { hostname: _hostname, port: _port, auth: _user + ':' + _password };
   this.id = _cameraId;

   this.capturing = false;

   var that = this;

   Action.call(this, 'spycam:' + _name, _activator, _thing);

   this.on('activated', function () {
      console.log(that.name + ': received activated event');
      capture();
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');
      cancelCapture();
   });

   var capture = function() {
      if (!that.capturing) {
         that.capturing = true;

         // https active request
         that.options.path = '/++ssControlActiveMode?cameraNum=' + that.id;
         console.log(util.inspect(that.options, false, null));

         http.get(that.options, function(res) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            that.emit('activated', that.name);
         });
      }
   }

   var cancelCapture = function() {
      if (that.capturing) {
         that.capturing = false;

         // https passive request
         that.options.path = '/++ssControlPassiveMode?cameraNum=' + that.id;
         console.log(util.inspect(that.options, false, null));

         http.get(that.options, function(res) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            that.emit('deactivated', that.name);
         });
      }
   }
}

util.inherits(SpyCameraAction, Action);

module.exports = exports = SpyCameraAction;
