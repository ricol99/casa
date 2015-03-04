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
   _config.owner = this.casaArea;  // TBD ***** Should this be a string
   Thing.call(this, _config);

   this.anonymousClients = [];
   this.clients = [];
   this.states = [];
   this.activators = [];
   this.uber = false;

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
      that.anonymousClients[_socket.id] = new Connection(that, _socket);
   });

   http.listen(this.listeningPort, function(){
     console.log('listening on *:' + that.listeningPort);
   });
}

util.inherits(Casa, Thing);

Casa.prototype.nameClient = function(_connection, _name) {
   this.clients[_name] = _connection;
   this.anonymousClients[_connection.id] = null;
}

Casa.prototype.deleteMe = function(_connection) {
   if (_connection.peerName) {
      this.anonymousClients[_connection.socket.id] = null;
   } 
   else {
      this.clients[_connection.peerName] = null;
   }
   delete _connection;
}

function Connection(_server, _socket) {
   this.server = _server;
   this.name = _server.name;
   this.socket = _socket;

   this.peerName = null;

   var that = this;

   this.socket.on('error', function() {

      console.log('error');

      if (that.peerName) {
         console.log(that.name + ': Peer casa ' + that.peerName + ' dropped');
         that.server.emit('casa-lost', { peerName: that.peerName, socket: that.socket });
      }
      that.server.deleteMe(that);
   });

   this.socket.on('disconnect', function() {

      console.log('disconnect');

      if (that.peerName) {
         console.log(that.name + ': Peer casa ' + that.peerName + ' dropped');
         that.server.emit('casa-lost', { peerName: that.peerName, socket: that.socket });
      }
      that.server.deleteMe(that);
   });

   this.socket.on('login', function(_data) {
      console.log(that.name + ': login: ' + _data.casaName);
      that.peerName = _data.casaName;

      if (that.server.clients[that.peerName]) {
         console.log('loginnnnnnnnn');

         // old socket still open
         if (that.server.clients[that.peerName] == that) {
            console.log('resued');
            // socket has been reused
            console.log(that.name + ': Old socket has been reused for casa ' + _data.casaName + '. Closing both sessions....');
            that.socket.close();
            deleteMe(that);
         }
         else {
            console.log(that.name + ': Old socket still open for casa ' + _data.casaName + '. Closing old session and continuing.....');
            that.server.emit('casa-lost', { peerName: that.peerName, socket: that.server.clients[that.peerName].socket });
            console.log(that.name + ': Establishing new logon session after race with old socket.');
            that.server.nameClient(that, that.peerName); 
            that.socket.emit('loginAACCKK');
            that.server.emit('casa-joined', { peerName: that.peerName, socket: that.socket });
         }
      }
      else {
         console.log('name client');
         that.server.nameClient(that, that.peerName); 
         that.socket.emit('loginAACCKK');
         that.server.emit('casa-joined', { peerName: that.peerName, socket: that.socket });
      }
   });
}

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

Casa.prototype.setUber = function(_uber) {
   this.uber = _uber;
}

Casa.prototype.isUber = function() {
   return this.uber;
}

module.exports = exports = Casa;
