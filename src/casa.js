var util = require('util');
var Thing = require('./thing');
//var limb = require('limb')
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

function Casa(_name, _displayName, _listeningPort, _owner, _props) {
   this.listeningPort = _listeningPort;
   Thing.call(this, 'casa:' + _name, _displayName, _owner, _props);
   var that = this;

   app.get('/', function(req, res){
     res.sendFile(__dirname + '/index.html');
   });

   io.on('connection', function(socket) {
     console.log('a casa has joined');
     var name;

     socket.on('disconnect', function() {
       console.log(that.name + ': Peer casa ' + name + ' dropped');
       if (name) {
          that.emit('casa-lost', name);
       }
     });

     socket.on('login', function(data) {
       console.log(that.name + ': login: ' + data.name);
       name = data.name;
       that.emit('casa-joined', name);
     });

     socket.on('active', function(data) {
       console.log(that.name + ': Peer casa active event received from ' + name + ': ' + data);
     });
   });

   http.listen(this.listeningPort, function(){
     console.log('listening on *:' + that.listeningPort);
   });

   //limb.listen(this.listeningPort)
 
   //limb.on('client', function(client) {
     //// do stuff with newly client
     //console.log('New client id=' + client.id + ', name=' + client.data.name);
     //that.emit('casa-joined', client.data.name);
   //})

   //limb.on('drop', function(client) {
     //// do stuff with dropped client
     //console.log('Dropped client id=' + client.id + ', name=' + client.data.name);
     //that.emit('casa-lost', client.data.name);
   //})

}

util.inherits(Casa, Thing);

module.exports = exports = Casa;



