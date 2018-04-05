var dgram = require('dgram');
var socket = dgram.createSocket('udp4');

var testMessage = "[hello world] pid: " + process.pid;
var broadcastAddress = '255.255.255.255';
var broadcastPort = 4096;

socket.on('listening', function(){
    socket.setBroadcast(true);
});

socket.bind(broadcastPort);

socket.on("message", function ( data, rinfo ) {
	console.log("Message received from ", rinfo.address, " : ", data.toString());
});
