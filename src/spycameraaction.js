var http = require('http');
var util = require('util');
var Action = require('./action');
var CasaSystem = require('./casasystem');

function SpyCameraAction(_name, _hostname, _port, _user, _password, _cameraId, _activator, _thing) {

   this.options = { };
   this.id = 0;

   if (_name.name) {
      // constructing from object rather than params
      // Resolve source and target
      var casaSys = CasaSystem.mainInstance();
      var source = casaSys.findSource(_name.source);
      var target = (_name.target) ? casaSys.resolveObject(_name.target) : null;

      this.options = { hostname: _name.cctvHostname, port: _name.cctvPort, auth: _name.userId + ':' + _name.password };
      this.id = _name.cameraId;
      Action.call(this, _name, source, target);
   }
   else {
      this.options = { hostname: _hostname, port: _port, auth: _user + ':' + _password };
      this.id = _cameraId;
      Action.call(this, _name, _activator, _thing);
   }

   this.capturing = false;

   var that = this;


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

         http.get(that.options, function(res) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            that.emit('activated', { sourceName: that.name });
         }).on('error', function(e) {
            console.log("Got error: " + e.message);
         });
      }
   }

   var cancelCapture = function() {
      if (that.capturing) {
         that.capturing = false;

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
   }
}

util.inherits(SpyCameraAction, Action);

module.exports = exports = SpyCameraAction;
