// Load the TCP Library
var util = require('util');
var events = require('events');
net = require('net');

function Alarm(_config) {
   this.ipAddress = _config.ipAddress;
   this.port = _config.port;

   events.EventEmitter.call(this);
}

util.inherits(Alarm, events.EventEmitter);

Alarm.prototype.connect = function() {
   var that = this;
   console.log('Connecting to alarm');

   this.socket = net.createConnection(this.port, this.ipAddress);

   this.socket.on('connect', function(_buffer) {
      console.log('Connected to alarm');
   });

   this.socket.on('data', function(_buffer) {
      console.log("Alarm->Middle: "+_buffer.toString('ascii')+ " :: ", _buffer);
      that.emit('data', _buffer);
   });

   this.socket.on('end', function(_buffer) {
   });

   this.socket.on('error', function(_buffer) {
   });
};

Alarm.prototype.write = function(_buffer, _encoding, _callback) {
   console.log("Middle->Alarm: "+_buffer.toString('ascii')+ " :: ", _buffer);
   this.socket.write(_buffer, _encoding, _callback);
};

// Keep track of the chat clients
var clients = [];

var alarm = new Alarm({ ipAddress: "192.168.1.85", port: 10001 });
alarm.connect();

// Start a TCP Server
net.createServer(function (socket) {

  // Identify this client
  socket.name = socket.remoteAddress + ":" + socket.remotePort 

  alarm.on('data', function(_buffer) {
     console.log("Middle->Client: "+_buffer.toString('ascii')+ " :: ", _buffer);
     socket.write(_buffer);
  });

  // Put this new client in the list
  clients.push(socket);

  // Send a nice welcome message and announce
  //socket.write("Welcome " + socket.name + "\n");
  //broadcast(socket.name + " joined the chat\n", socket);
  console.log("New client: " + socket.name);

  // Handle incoming messages from clients.
  socket.on('data', function (_buffer) {
    console.log("Client->Middle: "+_buffer.toString('ascii')+" :: ", _buffer);
    alarm.write(_buffer);
  });

  // Remove the client from the list when it leaves
  socket.on('end', function () {
    clients.splice(clients.indexOf(socket), 1);
    console.log("Client disconnected");
  });

}).listen(10001);

// Put a friendly message on the terminal of the server.
console.log("Chat server running at port 10001");
