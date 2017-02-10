var util = require('util');
var events = require('events');
var express = require('express');
var app = express();
var http = require('http').Server(app);
//var storage = require('node-persist');
 
//var io = require('socket.io')(http);

var io = require('socket.io')(http, {
  allowUpgrades: true,
  transports: ['websocket']
});

var CasaSystem = require('./casasystem');

function Casa(_config) {
   this.uName = _config.name;
   this.casaSys = CasaSystem.mainInstance();
   this.portStart = 50000;
   this.nextPortToAllocate = this.portStart;
   this.ports = {};

   this.area = _config.area;
   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.listeningPort;
   events.EventEmitter.call(this);

   this.id = _config.id;
   this.gang = _config.gang;

   this.anonymousClients = [];
   this.clients = [];
   this.sources = [];
   this.sourceListeners = {};
   this.workers = [];
   this.uber = false;
   this.valid = true;

   //storage.initSync();

   var that = this;

   //app.get('/nuclear_alarm.mp3', function(req, res){
     //res.sendFile(__dirname + '/nuclear_alarm.mp3');
   //});

   this.buildSimpleConfig(_config);

   app.get('/index.html', function(req, res){
     res.sendFile(__dirname + '/index.html');
   });

   app.get('/source/:source', function(req, res) {
      var allProps = {};

      if (that.casaSys.allObjects[req.params.source]) {

         for (var name in that.casaSys.allObjects[req.params.source].props) {
            allProps[name] = that.casaSys.allObjects[req.params.source].props[name].value;
         }
      }

      res.json(allProps);
   });

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

   var len = _config.things.length;
   for (var j = 0; j < len; ++j) {
      this.config.sources.push(_config.things[j].name);
      this.config.sourcesStatus.push({ properties: {}, status: false });
   }

   var len = _config.users.length;
   for (var k = j; k < len + j; ++k) {
      this.config.sources.push(_config.users[k-j].name);
      this.config.sourcesStatus.push({ properties: {}, status: false });
   }
}

Casa.prototype.refreshSourceListeners = function() {

   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop)) {
         this.sourceListeners[prop].refreshSource();
      }
   }
}

Casa.prototype.clientHasBeenNamed = function(_connection) {
   this.clients[_connection.peerName] = _connection;
   delete this.anonymousClients[_connection.socket.id];
}

Casa.prototype.deleteMe = function(_connection) {

   // Deal with race conditions
   if (_connection.deleted) {
      return;
   }

   console.log(this.uName + ': deleting server connection object!');

   var remoteCasa = _connection.remoteCasa;

   if (!_connection.peerName) {
      console.log(this.uName + ': deleting anonymous connection object!');
      delete this.anonymousClients[_connection.socket.id];
   } 
   else {
      console.log(this.uName + ': deleting connection object with name ' + _connection.peerName);
      delete this.clients[_connection.peerName];
   }

   if (remoteCasa) {
      console.log(this.uName + ': deleting remote casa ' + remoteCasa.uName);
      remoteCasa.removeCasaListeners();
      remoteCasa.invalidateSources();
      remoteCasa.setCasaArea(null);
      delete this.casaSys.remoteCasas[remoteCasa.uName];
      delete this.casaSys.allObjects[remoteCasa.uName];
      delete remoteCasa;
   }

   _connection.deleted = true;
   delete _connection;
}

function Connection(_server, _socket) {
   this.server = _server;
   this.uName = _server.uName;
   this.socket = _socket;

   this.remoteCasa = null;
   this.peerName = null;

   var that = this;

   this.socket.on('error', function() {

      if (that.peerName) {
         console.log(that.uName + ': Peer casa ' + that.peerName + ' dropped');
         that.server.emit('casa-lost', { peerName: that.peerName, socket: that.socket });
      }
      setTimeout(function() {
         that.server.deleteMe(that);
      }, 300);
   });

   this.socket.on('disconnect', function() {

      if (that.peerName) {
         console.log(that.uName + ': Peer casa ' + that.peerName + ' dropped');
         that.server.emit('casa-lost', { peerName: that.peerName, socket: that.socket });
      }
      setTimeout(function() {
         that.server.deleteMe(that);
      }, 300);
   });

   this.socket.on('login', function(_data) {
      console.log(that.uName + ': login: ' + _data.casaName);

      if (!_data.messageId) {
         setTimeout(function() {
            that.server.deleteMe(that);
         }, 300);
         return;
      }

      if (_data.casaVersion && _data.casaVersion < parseFloat(that.server.casaSys.version)) {
         console.info(that.uName + ': rejecting login from casa' + _data.casaName + '. Version mismatch!');
         that.socket.emit('loginRREEJJ', { messageId: _data.messageId, casaName: that.server.uName, reason: "version-mismatch" });

         setTimeout(function() {
            that.server.deleteMe(that);
         }, 300);
         return;
      }

      that.peerName = _data.casaName;

      if (that.server.clients[that.peerName]) {

         // old socket still open
         if (that.server.clients[that.peerName] == that) {
            // socket has been reused
            console.log(that.uName + ': Old socket has been reused for casa ' + _data.casaName + '. Closing both sessions....');

            setTimeout(function() {
               that.server.deleteMe(that);
            }, 300);
         }
         else {
            console.log(that.uName + ': Old socket still open for casa ' + _data.casaName + '. Closing old session and continuing.....');
            that.server.emit('casa-lost', { peerName: that.peerName, socket: that.server.clients[that.peerName].socket });

            setTimeout(function() {
               that.server.deleteMe(that.server.clients[that.peerName]);

               console.log(that.uName + ': Establishing new logon session after race with old socket.');
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
   var len = this.config.sources.length;

   for (var i = 0; i < len; ++i) {
      var allProps = {};
      var props = this.sources[this.config.sources[i]].props

      for (var name in props) {

         if (props.hasOwnProperty(prop)) {
            allProps[name] = props[name].value;
         }
      }

      this.config.sourcesStatus.push({ properties: copyData(allProps), status: this.sources[this.config.sources[i++]].isActive() });
   }
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
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

   // Build Sources
   var len = _data.casaConfig.sourcesStatus.length;
   console.log(this.uName + ': New sources found = ' + len);

   var PeerSource = require('./peersource');

   for (var i = 0; i < len; ++i) {
      console.log(this.uName + ': Creating peer source named ' + _data.casaConfig.sources[i]);
      var source = new PeerSource(_data.casaConfig.sources[i], _data.casaConfig.sourcesStatus[i].properties, remoteCasa);
   }

   // Refresh all inactive sources and workers
   this.refreshSourceListeners();

   return remoteCasa;
}

Casa.prototype.addSource = function(_source) {
   console.log(this.uName + ': Source '  + _source.uName + ' added to casa ');
   this.sources[_source.uName] = _source;
   var that = this;

   _source.on('property-changed', function (_data) {
      console.log(that.uName + ': ' + _data.sourceName + ' has had a property change');
      that.emit('source-property-changed', _data);
   });

   console.log(this.uName + ': ' + _source.uName + ' associated!');
}

Casa.prototype.addSourceListener = function(_sourceListener) {

   if (this.sourceListeners[_sourceListener.uName]) {
      console.log("***********SOURCELISTENER NAME CONFLICT***************" + _sourceListener.uName);
      process.exit();
   }

   console.log(this.uName + ': Source listener ' + _sourceListener.uName + ' added to casa');
   this.sourceListeners[_sourceListener.uName] = _sourceListener;
}

Casa.prototype.addWorker = function(_worker) {
   console.log(this.uName + ': Worker '  + _worker.uName + ' added to casa ');
   this.workers[_worker.uName] = _worker;
}

Casa.prototype.setUber = function(_uber) {
   this.uber = _uber;
}

Casa.prototype.isUber = function() {
   return this.uber;
}

Casa.prototype.allocatePort = function(_uName) {
   this.ports[_uName] = this.nextPortToAllocate;
   return this.nextPortToAllocate++;
}

module.exports = exports = Casa;
