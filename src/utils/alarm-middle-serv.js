// Load the TCP Library
var util = require('util');
var events = require('events');
net = require('net');

function Alarm(_config) {
   this.ipAddress = _config.ipAddress;
   this.port = _config.port;
   this.connected = false;

   events.EventEmitter.call(this);
}

util.inherits(Alarm, events.EventEmitter);

Alarm.prototype.connect = function() {
   var that = this;
   console.log('Connecting to alarm');

   this.socket = net.createConnection(this.port, this.ipAddress);

   this.socket.on('connect', function(_buffer) {
      console.log('Connected to alarm');
      that.connected = true;

      if (that.storedBuffer) {
         setTimeout(function(_this) {
            //console.log("Middle->Alarm: "+_this.storedBuffer.toString('ascii')+ " :: ", _this.storedBuffer);
            console.log("Middle->Alarm: ", _this.storedBuffer);
            _this.socket.write(_this.storedBuffer);
         }, 1500, that);
      }
   });

   this.socket.on('data', function(_buffer) {
      console.log("Alarm->Middle: ", _buffer);
      that.emit('data', _buffer);
   });

   this.socket.on('end', function(_buffer) {
   });

   this.socket.on('error', function(_buffer) {
   });
};

Alarm.prototype.write = function(_buffer, _encoding, _callback) {

   if (!this.connected) {
      this.storedBuffer = _buffer;
   }
   else {
      console.log("Middle->Alarm: ", _buffer);
      this.socket.write(_buffer, _encoding, _callback);
   }
};

Alarm.prototype.end = function() {
   this.socket.end();
};

// Keep track of the chat clients
var clients = [];

// Start a TCP Server
net.createServer(function (socket) {

  // Identify this client
  socket.name = socket.remoteAddress + ":" + socket.remotePort 

  var alarm = new Alarm({ ipAddress: "192.168.1.85", port: 10001 });
  alarm.connect();

  alarm.on('data', function(_buffer) {
     console.log("Middle->Client: ", _buffer);
     socket.write(_buffer);
  });

  // Put this new client in the list
  clients.push(socket);
  console.log("New client: " + socket.name);

  // Handle incoming messages from clients.
  socket.on('data', function (_buffer) {
    console.log("Client->Middle: ", _buffer);
    alarm.write(_buffer);
  });

  // Remove the client from the list when it leaves
  socket.on('end', function () {
    clients.splice(clients.indexOf(socket), 1);
    console.log("Client disconnected");
    alarm.end();
  });

}).listen(10001);

// Put a friendly message on the terminal of the server.
console.log("Chat server running at port 10001");
