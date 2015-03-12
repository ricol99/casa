var util = require('util');
var Thing = require('./thing');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var CasaSystem = require('./casasystem');

function Casa(_config) {

   this.casaSys = CasaSystem.mainInstance();

   this.area = _config.area;
   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.listeningPort;
   Thing.call(this, _config);

   this.id = _config.id;
   this.gang = _config.gang;

   this.anonymousClients = [];
   this.clients = [];
   this.states = [];
   this.activators = [];
   this.actions = [];
   this.uber = false;

   var that = this;

   //app.get('/nuclear_alarm.mp3', function(req, res){
     //res.sendFile(__dirname + '/nuclear_alarm.mp3');
   //});

   this.buildSimpleConfig(_config);

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

Casa.prototype.buildSimpleConfig = function(_config) {
   this.config = {};
   this.config.name = _config.name;
   this.config.displayName = _config.displayName;
   if (_config.gang) this.config.gang = _config.gang;
   this.config.states = [];
   this.config.activators = [];

   var len = _config.states.length;
   for (var i = 0; i < len; ++i) {
      this.config.states[i] = _config.states[i].name;
   }

   var len = _config.activators.length;
   for (var j = 0; j < len; ++j) {
      this.config.activators[j] = _config.activators[j].name;
   }
}

Casa.prototype.refreshActivatorsAndActions = function() {

   for(var prop in this.activators) {

      if(this.activators.hasOwnProperty(prop)){
         this.activators[prop].refreshSources();
      }
   }

   for(var prop in this.actions) {

      if(this.actions.hasOwnProperty(prop)){
         this.actions[prop].refreshSources();
      }
   }

}

Casa.prototype.nameClient = function(_connection, _name, _remoteCasa) {
   this.clients[_name] = _connection;
   this.anonymousClients[_connection.id] = null;
   this.remoteCasa = _remoteCasa;
}

Casa.prototype.deleteMe = function(_connection) {
   if (_connection.peerName) {
      this.anonymousClients[_connection.socket.id] = null;
   } 
   else {
      this.clients[_connection.peerName] = null;
   }
   if (this.remoteCasa) {
      this.remoteCasa.invalidateSources();
      this.casaSys.remoteCasas[this.remoteCasa.name] = null;
      delete this.remoteCasa;
   }

   delete _connection;
}

function Connection(_server, _socket) {
   this.server = _server;
   this.name = _server.name;
   this.socket = _socket;

   this.remoteCasa = null;
   this.peerName = null;

   var that = this;

   this.socket.on('error', function() {

      if (that.peerName) {
         console.log(that.name + ': Peer casa ' + that.peerName + ' dropped');
         that.server.emit('casa-lost', { peerName: that.peerName, socket: that.socket });
      }
      that.server.deleteMe(that);
   });

   this.socket.on('disconnect', function() {

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

         // old socket still open
         if (that.server.clients[that.peerName] == that) {
            // socket has been reused
            console.log(that.name + ': Old socket has been reused for casa ' + _data.casaName + '. Closing both sessions....');
            that.socket.close();
            deleteMe(that);
         }
         else {
            console.log(that.name + ': Old socket still open for casa ' + _data.casaName + '. Closing old session and continuing.....');
            that.server.emit('casa-lost', { peerName: that.peerName, socket: that.server.clients[that.peerName].socket });
            console.log(that.name + ': Establishing new logon session after race with old socket.');
            var remoteCasa = that.server.createRemoteCasa(_data);
            that.server.nameClient(that, that.peerName, remoteCasa); 

            that.socket.emit('loginAACCKK', { casaName: that.server.name, casaConfig: that.server.config });
            setTimeout(function() {
               console.log('hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh');
               that.socket.emit('casa-active', { sourceName: that.name, config: that.config });
            }, 2000);

            that.server.emit('casa-joined', { peerName: that.peerName, socket: that.socket, data: _data });
         }
      }
      else {
         var remoteCasa = that.server.createRemoteCasa(_data);
         that.server.nameClient(that, that.peerName, remoteCasa); 
         that.socket.emit('loginAACCKK', { casaName: that.server.name, casaConfig: that.server.config });
         that.server.emit('casa-joined', { peerName: that.peerName, socket: that.socket, data: _data });
      }
   });
}

Casa.prototype.createRemoteCasa = function(_data) {
   var remoteCasa;

   if (_data.casaType == 'child') {
      remoteCasa = this.casaSys.createChildCasa(_data.casaConfig, _data.peers);
   }
   else if (_data.casaType == 'peer') {
      remoteCasa = this.casaSys.createPeerCasa(_data.casaConfig);
   }

   // Build states and Activators
   var len = _data.casaConfig.states.length;
   console.log(this.name + ': New states found = ' + len);

   var PeerState = require('./peerstate');
   for (var i = 0; i < len; ++i) {
      console.log(this.name + ': Creating peer state named ' + _data.casaConfig.states[i]);
      var source = new PeerState(_data.casaConfig.states[i], remoteCasa);
      this.casaSys.allObjects[source.name] = source;
   }

   len = _data.casaConfig.activators.length;
   console.log(this.name + ': New activators found = ' + len);

   var PeerActivator = require('./peeractivator');
   for (i = 0; i < len; ++i) {
      console.log(this.name + ': Creating peer activator named ' + _data.casaConfig.activators[i]);
      var source = new PeerActivator(_data.casaConfig.activators[i], remoteCasa);
      this.casaSys.allObjects[source.name] = source;
   }

   // Refresh all inactive activators and actions
   this.refreshActivatorsAndActions();

   return remoteCasa;
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

Casa.prototype.addAction = function(_action) {
   console.log(this.name + ': Action '  + _action.name + ' added to casa ');
   this.actions[_action.name] = _action;
   var that = this;
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
