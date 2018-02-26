var util = require('util');
var events = require('events');
var express;
var app;
var http;
var io;

var CasaSystem = require('./casasystem');

function Casa(_config) {
   this.uName = _config.name;
   this.casaSys = CasaSystem.mainInstance();
   this.portStart = 50000;
   this.nextPortToAllocate = this.portStart;
   this.ports = {};
   this.secureMode = _config.secureMode;
   this.certPath = _config.certPath;
   this.configPath = _config.configPath;

   this.area = _config.area;
   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.listeningPort;
   events.EventEmitter.call(this);

   this.id = _config.id;
   this.gang = _config.gang;

   this.sources = [];
   this.sourceListeners = {};
   this.workers = [];
   this.uber = false;
   this.valid = true;

   this.buildSimpleConfig(_config);
   this.createServer();
}

util.inherits(Casa, events.EventEmitter);

Casa.prototype.createServer = function() {
   express = require('express');
   app = express();

   if (this.secureMode) {
      var fs = require('fs');

      var serverOptions = {
        key: fs.readFileSync(this.certPath+'/server.key'),
        cert: fs.readFileSync(this.certPath+'/server.crt'),
        ca: fs.readFileSync(this.certPath+'/ca.crt'),
        requestCert: true,
        rejectUnauthorized: true
      };

      http = require('https').Server(serverOptions, app);
      io = require('socket.io')(http, { allowUpgrades: true });
   }
   else {
      http = require('http').Server(app);

      io = require('socket.io')(http, {
         allowUpgrades: true,
         transports: ['websocket']
      });
   }

   app.get('/index.html', (req, res) => {
     res.sendFile(__dirname + '/index.html');
   });

   app.get('/configfile/:filename', (req, res) => {
      console.log(this.uName + ": Serving file " + req.params.filename);
      res.sendFile(this.configPath + '/' + req.params.filename);
   });

   app.get('/source/:source', (req, res) => {
      var allProps = {};
      var source = this.casaSys.allObjects[req.params.source];

      if (source) {
         source.getAllProperties(allProps);
      }

      res.json(allProps);
   });

   io.on('connection', (_socket) => {
      console.log('a casa has joined');
      var peerCasa = this.casaSys.createPeerCasa({name: "casa:anonymous:"+Date.now()}, true);
      peerCasa.serveClient(_socket);
   });

   http.listen(this.listeningPort, () => {
      console.log('listening on *:' + this.listeningPort);
   });
};

Casa.prototype.buildSimpleConfig = function(_config) {
   this.config = {};
   this.config.name = _config.name;
   this.config.displayName = _config.displayName;

   if (_config.gang) {
      this.config.gang = _config.gang;
   }

   this.config.sources = [];
   this.config.sourcesStatus = [];

   if (_config.hasOwnProperty('things')) {
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
}

Casa.prototype.refreshSourceListeners = function() {
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop)) {
         this.sourceListeners[prop].refreshSource();
      }
   }
}

Casa.prototype.refreshConfigWithSourcesStatus = function() {
   delete this.config.sourcesStatus;
   this.config.sourcesStatus = [];
   var len = this.config.sources.length;

   for (var i = 0; i < len; ++i) {
      var allProps = {}; 
      var source = this.sources[this.config.sources[i]];

      if (source) {
         source.getAllProperties(allProps);
      }
      this.config.sourcesStatus.push({ properties: copyData(allProps), status: this.sources[this.config.sources[i]].isActive() });
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
   _data.casaConfig.secureMode = this.secureMode;
   _data.casaConfig.certPath = this.certPath;

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

   // Cold start Peer Casa
   remoteCasa.coldStart();

   // Cold start all the peers sources now that everything has been created
   remoteCasa.coldStartPeerSources();

   return remoteCasa;
}

Casa.prototype.addSource = function(_source) {
   console.log(this.uName + ': Source '  + _source.uName + ' added to casa ');
   this.sources[_source.uName] = _source;

   _source.on('property-changed', (_data) => {
      console.log(this.uName + ': ' + _data.sourceName + ' has had a property change');
      this.emit('source-property-changed', _data);
   });

   _source.on('event-raised', (_data) => {
      console.log(this.uName + ': ' + _data.sourceName + ' has raised an event');
      this.emit('source-event-raised', _data);
   });

   console.log(this.uName + ': ' + _source.uName + ' associated!');
};

Casa.prototype.renameSource = function(_source, _newName) {
   console.log(this.uName + ': Renaming source '  + _source.uName + ' to ' + _newName);
   delete this.sources[_source.uName];
   this.sources[_newName] = _source;

   // ** TBD Don't like this! HACK!
   if (this.casaSys.allObjects[_source.uName]) {
      delete this.casaSys.allObjects[_source.uName];
   }
   this.casaSys.allObjects[_newName] = _source;
};

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

Casa.prototype.getProperty = function(_property) {
   return true;
}

module.exports = exports = Casa;
