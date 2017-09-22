var util = require('util');
var Service = require('../service');
var Dgram = require('dgram');

function LightwaveRfService(_config) {
   Service.call(this, _config);

   this.linkAddress = _config.linkAddress;
   this.requestTimeout = _config.hasOwnProperty("requestTimeout") ? _config.requestTimeout : 3;

   this.queue = [];
   this.requestPending = false;
   this.messageNumber = 0;

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
   //console.log(this.uName+": AAAAA -- Receiver socket message: " + _message + " from " + _info.address + ":" + _info.port);

   //Check this came from the lightwave unit
   if ((_info.address !== this.linkAddress) || !_message || (_message.charAt(0) === '*')) {
      return;
   }

   var message = _message.toString("utf8");
   var parts = message.split(",");
   var code = parts.splice(0,1);
   var content = parts.join(",").replace(/(\r\n|\n|\r)/gm,"");

   // XXX TBD Check content for error code
   this.completeRequest(code.toString(), null, content);
};
	
LightwaveRfService.prototype.turnDeviceOn = function(_roomId, _deviceId, _callback) {
   this.addToQueue("!R" + _roomId + "D" + _deviceId + "F1|\0", _callback);
}

LightwaveRfService.prototype.turnDeviceOff = function(_roomId, _deviceId, _callback) {
   this.addToQueue("!R" + _roomId + "D" + _deviceId + "F0|\0", _callback);
}

LightwaveRfService.prototype.setDeviceDim = function(_roomId, _deviceId, _dimLevel, _callback) {
   this.addToQueue("!R" + _roomId + "D" + _deviceId + "FdP" + parseInt(_dimLevel * 0.32) + "|\0", _callback);
}

LightwaveRfService.prototype.setRoomMood = function(_roomId, _moodId, _callback) {
   this.addToQueue("!R" + _roomId + "FmP" + _moodId + "|\0", _callback);
}

LightwaveRfService.prototype.turnRoomOff = function(_roomId, _callback) {
   this.addToQueue("!R" + _roomId + "Fa\0", _callback);
}

LightwaveRfService.prototype.registerWithLink = function(_callback) {
   this.addToQueue("!R1Fa", _callback);
}

LightwaveRfService.prototype.addToQueue = function(_message, _callback) {
   this.queue.push(new Request(this, _message, _callback));
   this.makeNextRequest();
}

LightwaveRfService.prototype.makeNextRequest = function() {

   if ((this.queue.length > 0) && !this.requestPending) {
      this.requestPending = true;
      this.queue[0].send(++this.messageNumber);
   }
}

LightwaveRfService.prototype.completeRequest = function(_code, _error, _content) {
   console.log(this.uName + ': Request done! Code='+_code);

   if (this.requests[_code] && this.queue.length > 0 && this.queue[0].code === _code) {
      this.queue.shift().complete(_error, _content);
      delete this.requests[_code];

      if (this.queue.length > 0) {

         // More in the queue, so reschedule after the link has had time to settle down
         var delay = setTimeout(function(_this) {
            _this.requestPending = false;
            _this.makeNextRequest();
         }, 250, this);
      }
      else {
         this.requestPending = false;
      }
   }
   else if (!this.requests[_code]) {
      console.error(this.uName+": Arhhhhhh - this code "+_code+" is not found!!!!!!");
   }
   else {
      console.error(this.uName + ": Something bad is happening - the received code does not match the top request in the queue!");
      console.error(this.uName + ": Code=" + _code + " queue length= " + this.queue.length);

      if (this.queue.length > 0) {
         console.error(this.uName + ": Top request in queue has code " + this.queue[0].code);
      }
   }
}

LightwaveRfService.prototype.sendMessageToLink = function(_request){
   //Get 3 digit code from counter
   var zeroPadCode = _request.code;

   while (zeroPadCode.length < 3) {
      zeroPadCode = "0" + zeroPadCode;
   }
   var buffer = new Buffer(zeroPadCode + "," + _request.message);
	
   //Broadcast the message
   this.sendSocket.send(buffer, 0, buffer.length, 9760, this.linkAddress);
   //console.log(this.uName + ": AAAAA Sending message '"+buffer.toString()+"' to lightwave link");
	
   //Add listener
   this.requests[_request.code] = _request;
}

function Request(_owner, _message, _callback) {
   this.owner = _owner;
   this.message = _message;
   this.callback = _callback;
}

Request.prototype.send = function(_code) {
   this.code = _code.toString();

   this.owner.sendMessageToLink(this);

   this.timeout = setTimeout(function(_this) {
      _this.owner.completeRequest(_this.code, 'Request timed out!', null);
   }, this.owner.requestTimeout*1000, this);
};

Request.prototype.complete = function(_error, _content) {
   clearTimeout(this.timeout);
   this.callback(_error, _content);
};

module.exports = exports = LightwaveRfService;
