var util = require('util');
var Thing = require('./thing');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var CasaSystem = require('./casasystem');

function Casa(_config) {
   var casaSys = CasaSystem.mainInstance();
   this.casaArea = casaSys.findCasaArea(_config.casaArea);

   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.address.port;
   _config.owner = this.casaArea;

   Thing.call(this, _config);

   this.clients = [];
   this.states = [];
   this.activators = [];
   this.actions = [];

   var that = this;

   this.casaArea.addCasa(this);

   app.get('/nuclear_alarm.mp3', function(req, res){
     res.sendFile(__dirname + '/nuclear_alarm.mp3');
   });

   app.get('/index.html', function(req, res){
     res.sendFile(__dirname + '/index.html');
   });

   io.on('connection', function(_socket) {
      console.log('a casa has joined');
      var peerName = null;

      _socket.on('error', function() {
         if (peerName) {
            console.log(that.name + ': Peer casa ' + peerName + ' dropped');
            that.clients[peerName] = null;
            that.emit('casa-lost', { peerName: peerName, socket: _socket });
            peerName = null;
         }
      });

      _socket.on('disconnect', function() {
         if (peerName) {
            that.clients[peerName] = null;
            console.log(that.name + ': Peer casa ' + peerName + ' dropped');
            that.emit('casa-lost', { peerName: peerName, socket: _socket });
            peerName = null;
         }
      });

      _socket.on('login', function(_data) {
         console.log(that.name + ': login: ' + _data.casaName);
         peerName = _data.casaName;
         if (that.clients[peerName]) {
            // old socket still open
            if (_socket == that.clients[peerName]) {
               // socket has been reused
               console.log(that.name + ': Old socket has been reused for casa ' + _data.casaName + '. Closing both sessions....');
               _socket.close();
            }
            else {
               console.log(that.name + ': Old socket still open for casa ' + _data.casaName + '. Closing old session and continuing.....');
               that.emit('casa-lost', { peerName: peerName, socket: that.clients[peerName] });
               console.log(that.name + ': Establishing new logon session after race with old socket.');
               that.clients[peerName] = _socket;
               _socket.emit('loginAACCKK');
               that.emit('casa-joined', { peerName: peerName, socket: _socket });
            }
         }
         else {
            that.clients[peerName] = _socket;
            _socket.emit('loginAACCKK');
            that.emit('casa-joined', { peerName: peerName, socket: _socket });
         }
      });
   });

   http.listen(this.listeningPort, function(){
     console.log('listening on *:' + that.listeningPort);
   });

}

util.inherits(Casa, Thing);

Casa.prototype.addState = function(_state) {
   console.log(this.name + ': State '  +_state.name + ' added to casa ');
   this.states[_state.name] = _state;
   var that = this;

   _state.on('active', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has become active');
      that.emit('state-active', _data);
   });

   _state.on('inactive', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has become inactive');
      that.emit('state-inactive', _data);
   });

   console.log(this.name + ': ' + _state.name + ' associated!');
}

Casa.prototype.addActivator = function(_activator) {
   console.log(this.name + ': Activator '  + _activator.name + ' added to casa ');
   this.activators[_activator.name] = _activator;
   var that = this;

   _activator.on('active', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has become active');
      that.emit('activator-active', _data);
   });

   _activator.on('inactive', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has become inactive');
      that.emit('activator-inactive', _data);
   });

   console.log(this.name + ': ' + _activator.name + ' associated!');
}

Casa.prototype.findState = function(_stateName) {
   return this.states[_stateName];
}

module.exports = exports = Casa;
