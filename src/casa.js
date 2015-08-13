var util = require('util');
var events = require('events');
var express = require('express');
var app = express();
var http = require('http').Server(app);
//var io = require('socket.io')(http);

var io = require('socket.io')(http, {
  allowUpgrades: true,
  transports: ['websocket']
});

var CasaSystem = require('./casasystem');

function Casa(_config) {
   this.name = _config.name;
   this.casaSys = CasaSystem.mainInstance();

   this.area = _config.area;
   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.listeningPort;
   events.EventEmitter.call(this);

   this.id = _config.id;
   this.gang = _config.gang;

   this.anonymousClients = [];
   this.clients = [];
   this.sources = [];
   this.sourceListeners = {};
   this.actions = [];
   this.uber = false;
   this.sourceEnabled = true;

   var that = this;

   //app.get('/nuclear_alarm.mp3', function(req, res){
     //res.sendFile(__dirname + '/nuclear_alarm.mp3');
   //});

   this.buildSimpleConfig(_config);

   //app.get('/index.html', function(req, res){
     //res.sendFile(__dirname + '/index.html');
   //});

   io.on('connection', function(_socket) {
      console.log('a casa has joined');
      that.anonymousClients[_socket.id] = new Connection(that, _socket);
   });

   http.listen(this.listeningPort, function(){
      console.log('listening on *:' + that.listeningPort);
   });
}

util.inherits(Casa, events.EventEmitter);

Casa.prototype.buildSimpleConfig = function(_config) {
   this.config = {};
   this.config.name = _config.name;
   this.config.displayName = _config.displayName;
   if (_config.gang) this.config.gang = _config.gang;
   this.config.sources = [];
   this.config.sourcesStatus = [];

   var len = _config.states.length;
   for (var i = 0; i < len; ++i) {
      this.config.sources.push(_config.states[i].name);
      this.config.sourcesStatus.push({ properties: {}, status: false });
   }

   var len = _config.activators.length;
   for (var j = i; j < len + i; ++j) {
      this.config.sources.push(_config.activators[j-i].name);
      this.config.sourcesStatus.push({ properties: {}, status: false });
   }

   var len = _config.things.length;
   for (var k = j; k < len + j; ++k) {
      this.config.sources.push(_config.things[k-j].name);
      this.config.sourcesStatus.push({ properties: {}, status: false });
   }

   var len = _config.users.length;
   for (var l = k; l < len + k; ++l) {
      this.config.sources.push(_config.users[l-k].name);
      this.config.sourcesStatus.push({ properties: {}, status: false });
   }

}

Casa.prototype.refreshSourceListeners = function() {

   for(var prop in this.sourceListeners) {
      if(this.sourceListeners.hasOwnProperty(prop)){
         this.sourceListeners[prop].refreshSources();
      }
   }
}

Casa.prototype.clientHasBeenNamed = function(_connection) {
   this.clients[_connection.peerName] = _connection;
   delete this.anonymousClients[_connection.socket.id];
}

Casa.prototype.deleteMe = function(_connection) {
   console.log(this.name + ': deleting server connection object!');

   var remoteCasa = _connection.remoteCasa;

   if (!_connection.peerName) {
      console.log(this.name + ': deleting anonymous connection object!');
      delete this.anonymousClients[_connection.socket.id];
   } 
   else {
      console.log(this.name + ': deleting connection object with name ' + _connection.peerName);
      delete this.clients[_connection.peerName];
   }

   if (remoteCasa) {
      console.log(this.name + ': deleting remote casa ' + remoteCasa.name);
      remoteCasa.removeCasaListeners();
      remoteCasa.invalidateSources();
      remoteCasa.setCasaArea(null);
      delete this.casaSys.remoteCasas[remoteCasa.name];
      delete this.casaSys.allObjects[remoteCasa.name];
      delete remoteCasa;
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
      setTimeout(function() {
         that.server.deleteMe(that);
      }, 300);
   });

   this.socket.on('disconnect', function() {

      if (that.peerName) {
         console.log(that.name + ': Peer casa ' + that.peerName + ' dropped');
         that.server.emit('casa-lost', { peerName: that.peerName, socket: that.socket });
      }
      setTimeout(function() {
         that.server.deleteMe(that);
      }, 300);
   });

   this.socket.on('login', function(_data) {
      console.log(that.name + ': login: ' + _data.casaName);

      if (!_data.messageId) {
         deleteMe(that);
         return;
      }

      that.peerName = _data.casaName;

      if (that.server.clients[that.peerName]) {

         // old socket still open
         if (that.server.clients[that.peerName] == that) {
            // socket has been reused
            console.log(that.name + ': Old socket has been reused for casa ' + _data.casaName + '. Closing both sessions....');
            deleteMe(that);
         }
         else {
            console.log(that.name + ': Old socket still open for casa ' + _data.casaName + '. Closing old session and continuing.....');
            that.server.emit('casa-lost', { peerName: that.peerName, socket: that.server.clients[that.peerName].socket });

            setTimeout(function() {
               that.server.deleteMe(that.server.clients[that.peerName]);

               console.log(that.name + ': Establishing new logon session after race with old socket.');
               that.remoteCasa = that.server.createRemoteCasa(_data);
               that.server.clientHasBeenNamed(that); 
               that.server.refreshConfigWithSourcesStatus();
               that.server.emit('casa-joined', { messageId: _data.messageId, peerName: that.peerName, socket: that.socket, data: _data });
            }, 300);
         }
      }
      else {
         that.remoteCasa = that.server.createRemoteCasa(_data);
         that.server.clientHasBeenNamed(that); 
         that.server.refreshConfigWithSourcesStatus();
         that.server.emit('casa-joined', { messageId: _data.messageId, peerName: that.peerName, socket: that.socket, data: _data });
      }
   });
}

Casa.prototype.refreshConfigWithSourcesStatus = function() {
   delete this.config.sourcesStatus;
   this.config.sourcesStatus = [];

   var i = 0;
   for(var prop in this.config.sources) {
      this.config.sourcesStatus.push({ properties: this.sources[this.config.sources[i]].props,
                                       status: this.sources[this.config.sources[i++]].isActive() });
   }
}

Casa.prototype.isActive = function() {
   return true;
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
   var len = _data.casaConfig.sourcesStatus.length;
   console.log(this.name + ': New sources found = ' + len);

   var PeerSource = require('./peersource');
   for (var i = 0; i < len; ++i) {
      console.log(this.name + ': Creating peer source named ' + _data.casaConfig.sources[i]);
      var source = new PeerSource(_data.casaConfig.sources[i], _data.casaConfig.sourcesStatus[i].properties, remoteCasa);

      source.active = _data.casaConfig.sourcesStatus[i].status;
      this.casaSys.allObjects[source.name] = source;
   }

   // Refresh all inactive sources and actions
   this.refreshSourceListeners();

   // Cold start all the peers states now that everything has been created
   remoteCasa.coldStartPeerSources();

   return remoteCasa;
}

Casa.prototype.addSource = function(_source) {
   console.log(this.name + ': Source '  + _source.name + ' added to casa ');
   this.sources[_source.name] = _source;
   var that = this;

   _source.on('active', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has become active');
      that.emit('source-active', _data);
   });

   _source.on('inactive', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has become inactive');
      that.emit('source-inactive', _data);
   });

   _source.on('property-changed', function (_data) {
      console.log(that.name + ': ' + _data.sourceName + ' has had a property change');
      that.emit('source-property-changed', _data);
   });

   console.log(this.name + ': ' + _source.name + ' associated!');
}

Casa.prototype.addSourceListener = function(_sourceListener) {
   this.sourceListeners[_sourceListener.name] = _sourceListener;
}

Casa.prototype.addAction = function(_action) {
   console.log(this.name + ': Action '  + _action.name + ' added to casa ');
   this.actions[_action.name] = _action;
   var that = this;
}

Casa.prototype.findState = function(_stateName) {
   return this.sources[_stateName];
}

Casa.prototype.setUber = function(_uber) {
   this.uber = _uber;
}

Casa.prototype.isUber = function() {
   return this.uber;
}

module.exports = exports = Casa;
