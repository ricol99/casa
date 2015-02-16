var util = require('util');
var Thing = require('./thing');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

function Casa(_name, _displayName, _listeningPort, _casaArea, _parentCasaArea, _props) {
   this.listeningPort = _listeningPort;
   this.parentCasaArea = _parentCasaArea;

   Thing.call(this, 'casa:' + _name, _displayName, _casaArea, _props);
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
       that.emit('casa-joined', name, socket);
     });
   });

   http.listen(this.listeningPort, function(){
     console.log('listening on *:' + that.listeningPort);
   });

}

util.inherits(Casa, Thing);

Casa.prototype.addState = function(_state) {
   this.states[_state.name] = _state;
   that = this;

   _state.on('active', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has become active');
      that.emit('state-active', sourceName);
   });

   _state.on('inactive', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has become inactive');
      that.emit('state-inactive', sourceName);
   });

   console.log(this.name + ': ' + _state.name + ' associated!');
}


module.exports = exports = Casa;
