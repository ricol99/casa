var util = require('util');
var http = require('http');
var Cam = require('onvif').Cam;
var Thing = require('../thing');

function IpCamera(_config, _parent) {

   Thing.call(this, _config, _parent);
   var thingType = "camera";

   new Cam({ hostname: '192.168.1.177', username: 'admin', password: 'admin' }, function(err) {
      //this.absoluteMove({x: 1, y: 1, zoom: 1});
      this.getStreamUri({protocol:'RTSP'}, function(err, stream) {
          http.createServer(function (req, res) {
             res.writeHead(200, {'Content-Type': 'text/html'});
             res.end('<html><body>' + '<embed type="application/x-vlc-plugin" target="' + stream.uri + '"></embed>' + '</body></html>');
          }).listen(3030);
      });
   });
}

util.inherits(IpCamera, Thing);

// Called when current state required
IpCamera.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
IpCamera.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

IpCamera.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

IpCamera.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = IpCamera;
