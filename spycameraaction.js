var http = require('http');
var util = require('util');
var events = require('events');

function SpyCameraAction(_name, _hostname, _port, _user, _password, _cameraId, _activator) {
   this.name = 'spycam:' + _name;
   this.options = { hostname: _hostname, port: _port, auth: _user + ':' + _password };
   this.id = _cameraId;
   this.activator = _activator;

   this.capturing = false;

   var that = this;

   events.EventEmitter.call(this);

   this.activator.on('activate', function () {
      console.log(that.name + ': received activate event');
      capture();
   });

   this.activator.on('deactivate', function () {
      console.log(that.name + ': received deactivate event');
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

util.inherits(SpyCameraAction, events.EventEmitter);

module.exports = exports = SpyCameraAction;
