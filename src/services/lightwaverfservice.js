var util = require('util');
var Service = require('../service');
var Dgram = require('dgram');

function LightwaveRfService(_config) {
   Service.call(this, _config);

   this.linkAddress = _config.linkAddress;
   this.requestTimeout = _config.hasOwnProperty("requestTimeout") ? _config.requestTimeout : 3;

   this.queue = [];
   this.requestPending = false;
   this.messageCounter = 0;

   this.requests = {};

   this.sendSocket = Dgram.createSocket("udp4");
   this.receiveSocket = Dgram.createSocket("udp4");
}

util.inherits(LightwaveRfService, Service);

LightwaveRfService.prototype.coldStart = function() {
   var that = this;

   this.receiveSocket.on("message", function (_message, _info) {
      that.messageReceived(_message, _info);
   }.bind(this));

   this.receiveSocket.on("listening", function () {
      var address = this.receiveSocket.address();
      console.log(this.uName + ": Receiver socket listening " + address.address + ":" + address.port);
   }.bind(this));

   //Bind to the receive port
   this.receiveSocket.bind(9761);

   // Register with Link
   this.registerWithLink(function(_error, _content) {

      if (_error) {
         console.error(that.uName + ": Unable to register with link, error = "+ _error);
      }
   });
};

LightwaveRfService.prototype.messageReceived = function(_message, _info) {
   //console.log(" -- Receiver socket got: " + _message + " from " + _info.address + ":" + _info.port);

   //Check this came from the lightwave unit
   if (_info.address !== this.linkAddress) {
      return;
   }

   var message = _message.toString("utf8");
   var parts = message.split(",");
   var code = parts.splice(0,1);
   var content = parts.join(",").replace(/(\r\n|\n|\r)/gm,"");
   // XXX TBD Check content for error code

   if (this.requests[code.toString()]) {
      this.requests[code.toString()].complete(null, content);
      delete this.requests[code.toString()];
   }
};
	
LightwaveRfService.prototype.turnDeviceOn = function(_roomId, _deviceId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning device on, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      _this.sendMessageToLink("!R" + _params.roomId + "D" + _params.deviceId + "F1|\0", _cb);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.turnDeviceOff = function(_roomId, _deviceId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning device off, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      _this.sendMessageToLink("!R" + _params.roomId + "D" + _params.deviceId + "F0|\0", _cb);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.setDeviceDim = function(_roomId, _deviceId, _dimLevel, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning device on with dim level, roomId: ' + _params.roomId + ', _deviceId: ' + _params.deviceId + ', dimLevel: ' + _params.dimLevel);
      _this.sendMessageToLink("!R" + _params.roomId + "D" + _params.deviceId + "FdP" + parseInt(_params.dimLevel * 0.32) + "|\0", _cb);
   }, { roomId: _roomId, deviceId: _deviceId, dimLevel: _dimLevel } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.setRoomMood = function(_roomId, _moodId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': setting room mood, roomId: ' + _params.roomId + ' moodId:' + _params.moodId);
       _this.sendMessageToLink("!R" + _params.roomId + "FmP" + _params.moodId + "|\0", _cb);
   }, { roomId: _roomId, moodId: _moodId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.turnRoomOff = function(_roomId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning room off, roomId: ' + _params.roomId);
      _this.sendMessageToLink("!R" + _params.deviceId + "Fa\0", _cb);
   }, { roomId: _roomId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.registerWithLink = function(_callback) {

   if (!this.lastRegistrationTime || ((Date.now() - this.lastRegistrationTime) > 60000)) {
      this.lastRegistrationTime = Date.now();

      this.addToQueue(function(_this, _params, _cb) {
         console.log(_this.uName + ': Re-registering with link');
	 _this.sendMessageToLink("!R1Fa", _cb);
      }, {} , _callback, true);
   }
}

LightwaveRfService.prototype.addToQueue = function(_request, _params, _callback, _noReg) {
   this.queue.push({ request: _request, params: _params, callback: _callback });
}

LightwaveRfService.prototype.makeNextRequest = function() {
   var that = this;

   if ((this.queue.length > 0) && !this.requestPending) {
      this.requestPending = true;

      this.queue[0].request(this, this.queue[0].params, function(_error, _content) {
         console.log(that.uName + ': Request done!');
         that.queue.shift().callback(_error, _content);

         if (that.queue.length > 0) {

            // More in the queue, so reschedule after the link has had time to settle down
            var delay = setTimeout(function(_this) {
               _this.requestPending = false;
               _this.makeNextRequest();
            }, 250, that);
         }
         else {
            that.requestPending = false;
         }
      });
   }
}

LightwaveRfService.prototype.getMessageCode = function() {
   this.messageCounter++;
	
   //Get 3 digit code from counter
   var code = this.messageCounter.toString();

   while (code.length < 3) {
      code = "0" + code;
   }

   //Return the code
   return code;
};

LightwaveRfService.prototype.sendMessageToLink = function(_message, _callback){
   var code = this.getMessageCode();
   var buffer = new Buffer(code + "," + _message);
	
   //Broadcast the message
   this.sendSocket.send(buffer, 0, buffer.length, 9760, this.linkAddress);
	
   //Add listener
   if (_callback) {
      this.requests[parseInt(code).toString()] = new Request(this, parseInt(code).toString(), _callback);
   }
}

LightwaveRfService.prototype.deleteRequest = function(_request) {
   delete this.requests[_request.code];
};

function Request(_owner, _code, _callback) {
   this.owner = _owner;
   this.code = _code;
   this.callback = _callback;

   this.timeout = setTimeout(function(_this) {
      _this.callback("Request timed out!", null);
      _this.owner.deleteRequest(_this);
   }, this.owner.requestTimeout*1000, this);
}

Request.prototype.complete = function(_error, _content) {
   clearTimeout(this.timeout);
   this.callback(_error, _content);
};

module.exports = exports = LightwaveRfService;
