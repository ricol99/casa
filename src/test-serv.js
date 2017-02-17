var util = require('util');
var events = require('events');
var express = require('express');
var app = express();
var clientCertAuth = require('client-certificate-auth');

var fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var serverOptions = {
   key: fs.readFileSync(process.env['HOME']+'/.casa-keys/server.key'),
   cert: fs.readFileSync(process.env['HOME']+'/.casa-keys/server.crt'),
   ca: fs.readFileSync(process.env['HOME']+'/.casa-keys/ca.crt'),
   requestCert: true,
   rejectUnauthorized: false
};

app.use(clientCertAuth(function() {return true}));

console.log(serverOptions);
var https = require('https').Server(serverOptions, app);

var io = require('socket.io')(https, {
   allowUpgrades: true,
   transports: ['websocket']
});

app.get('/index.html', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/source/:source', function(req, res) {
   console.log(req.client.authorized);
   console.log(req.connection.getPeerCertificate().subject);
   res.json({testName: 'Richard'});
});

io.on('connection', function(_socket) {
   console.log('a casa has joined');
});

https.listen(8096, function(){
   console.log('listening on *: 8096');
});
