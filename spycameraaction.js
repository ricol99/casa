var http = require('http');
var util = require('util');
var events = require('events');

function SpyCameraAction(_name, _hostname, _port, _user, _password, _cameraId, _activator) {
   var name = 'spycam:' + _name;
   var options = { };
   options.hostname = _hostname;
   options.port = _port;
   options.auth = _user + ':' + _password;
   var id = _cameraId;
   var activator = _activator;

   var capturing = false;
   var that = this;

   events.EventEmitter.call(this);

   activator.on('activate', function () {
      console.log(name + ': received activate event');
      capture();
   });

   activator.on('deactivate', function () {
      console.log(name + ': received deactivate event');
      cancelCapture();
   });

   var capture = function() {
      if (!capturing) {
         capturing = true;

         // https active request
         options.path = '/++ssControlActiveMode?cameraNum=' + id;
         console.log(util.inspect(options, false, null));

         http.get(options, function(res) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            that.emit('activated', that.name);
         });
      }
   }

   var cancelCapture = function() {
      if (capturing) {
         capturing = false;

         // https passive request
         options.path = '/++ssControlPassiveMode?cameraNum=' + id;
         console.log(util.inspect(options, false, null));

         http.get(options, function(res) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            that.emit('deactivated', that.name);
         });
      }
   }
}

util.inherits(SpyCameraAction, events.EventEmitter);

var create = function(_name, _hostname, _port, _user, _password, _cameraId, _activator) {
   return new SpyCameraAction(_name, _hostname, _port, _user, _password, _cameraId, _activator);
}

exports.create = create;
exports.SpyCameraAction = SpyCameraAction;
