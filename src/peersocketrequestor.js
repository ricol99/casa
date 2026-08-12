var util = require('./util');

function PeerSocketRequestor(_config) {
   this.requestId = _config.requestId;
   this.callback = _config.callback;
   this.socket = _config.socket;
   this.timeoutMs = _config.hasOwnProperty("timeoutMs") ? _config.timeoutMs : 30000;
   this.timeout = null;
   this.message = null;
}

PeerSocketRequestor.prototype.sendRequest = function(_message, _deleteMe) {
   this.message = _message;
   this.socket.emit(this.message.message, this.message.data);
   this.startTimeout(_deleteMe);
};

PeerSocketRequestor.prototype.resendRequest = function(_deleteMe) {

   if (this.timeout) {
      util.clearTimeout(this.timeout);
   }

   this.socket.emit(this.message.message, this.message.data);
   this.startTimeout(_deleteMe);
};

PeerSocketRequestor.prototype.startTimeout = function(_deleteMe) {
   this.timeout = util.setTimeout( () => {
      this.callback("timeout");
      _deleteMe(this.requestId);
   }, this.timeoutMs);
};

PeerSocketRequestor.prototype.completeRequest = function(_result) {

   if (this.timeout) {
      util.clearTimeout(this.timeout);
      this.timeout = null;
   }

   this.callback(null, _result);
};

module.exports = exports = PeerSocketRequestor;
