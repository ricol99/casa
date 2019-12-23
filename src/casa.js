var util = require('./util');
var events = require('events');
var express;
var app;
var http;
var io;

var Gang = require('./gang');

function Casa(_config) {
   this.uName = _config.uName;
   this.gang = Gang.mainInstance();
   this._id = true;     // TDB!!!
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
   this.db = null;

   this.sources = {};
   this.sourceListeners = {};
   this.services = {};
   this.workers = {};

   this.uber = false;

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
      var source = this.gang.allObjects[req.params.source];

      if (source) {
         source.getAllProperties(allProps);
      }

      res.json(allProps);
   });

   io.of('/peercasa')
     .on('connection', (_socket) => {

      console.log('a casa has joined');
      var peerCasa = this.gang.createPeerCasa({uName: "casa:anonymous:"+Date.now()}, true);
      peerCasa.serveClient(_socket);
   });

   http.listen(this.listeningPort, () => {
      console.log('listening on *:' + this.listeningPort);
   });
};

Casa.prototype.refreshSourceListeners = function() {
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop)) {
         this.sourceListeners[prop].refreshSource();
      }
   }
};

Casa.prototype.getDb = function() {
   return this.db;
};

Casa.prototype.refreshSimpleConfig = function() {
   this.simpleConfig = {};
   this.simpleConfig.uName = this.uName;
   this.simpleConfig.displayName = this.displayName;
   this.simpleConfig.gang = this.gang.uName;
   this.simpleConfig.sources = [];
   this.simpleConfig.sourcesPriority = [];
   this.simpleConfig.sourcesStatus = [];

   for (sourceName in this.sources) {

      if (this.sources.hasOwnProperty(sourceName)) {
         var source = this.sources[sourceName];
         console.error(this.uName+":AAAAAA Source Name="+source.uName);

         if (!source.local) {
            var allProps = {};
            source.getAllProperties(allProps);

            this.simpleConfig.sources.push(source.uName);
            this.simpleConfig.sourcesPriority.push((source.hasOwnProperty('priority')) ? source.priority : 0);
            this.simpleConfig.sourcesStatus.push({ properties: util.copy(allProps) });
         }
      }
   }

   return this.simpleConfig;
};

Casa.prototype.getSource = function(_sourceName) {
   return this.sources[_sourceName];
};

Casa.prototype.isActive = function() {
   return true;
};

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

   this.emit('source-added', { sourceName: _source.uName });
   console.log(this.uName + ': ' + _source.uName + ' associated!');
};

Casa.prototype.renameSource = function(_source, _newName) {
   console.log(this.uName + ': Renaming source '  + _source.uName + ' to ' + _newName);
   delete this.sources[_source.uName];
   this.sources[_newName] = _source;

   // ** TBD Don't like this! HACK!
   if (this.gang.allObjects[_source.uName]) {
      delete this.gang.allObjects[_source.uName];
   }
   this.gang.allObjects[_newName] = _source;
   console.log(this.uName + ": Source: "+_source.uName+" is now referred to in casa as "+ _newName);
};

Casa.prototype.removeSource = function(_source) {
   console.log(this.uName + ': Deleting source '  + _source.uName);
   this.emit('source-removed', { sourceName: _source.uName });

   this.gang.removeThing(_source);
   delete this.sources[_source.uName];
};

Casa.prototype.addSourceListener = function(_sourceListener) {

   if (this.sourceListeners[_sourceListener.uName]) {
      console.log("***********SOURCELISTENER NAME CONFLICT***************" + _sourceListener.uName);
      process.exit(1);
   }

   console.log(this.uName + ': Source listener ' + _sourceListener.uName + ' added to casa');
   this.sourceListeners[_sourceListener.uName] = _sourceListener;
};

Casa.prototype.findListeners = function(_uName) {
   var listeners = [];

   for (var listener in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(listener)) {

         if (this.sourceListeners[listener].sourceName === _uName) {
            listeners.push(this.sourceListeners[listener]);
         }
      }
   }
   return listeners;
};

Casa.prototype.addService = function(_service) {
   console.log(this.uName + ': Service '  + _service.uName + ' added to casa ');

   if (this.services[_service.uName.split(":")[0]]) {
      console.log("***********SERVICE CONFLICT - Only one localservice per type allowed***************" + _service.uName);
      process.exit(1);
   }

   this.services[_service.uName.split(":")[0]]  = _service;
};

Casa.prototype.findService = function(_serviceType) {
   return (_serviceType.indexOf(":") !== -1) ? this.gang.findObject(_serviceType) : this.services[_serviceType];
};

Casa.prototype.findServiceName = function(_serviceType) {
   var service = this.findService(_serviceType);

   return (service) ? service.uName : null;
};

Casa.prototype.addWorker = function(_worker) {
   console.log(this.uName + ': Worker '  + _worker.uName + ' added to casa ');
   this.workers[_worker.uName] = _worker;
};

Casa.prototype.setUber = function(_uber) {
   this.uber = _uber;
};

Casa.prototype.isUber = function() {
   return this.uber;
};

Casa.prototype.allocatePort = function(_uName) {
   this.ports[_uName] = this.nextPortToAllocate;
   return this.nextPortToAllocate++;
};

Casa.prototype.getProperty = function(_property) {
   return true;
};

Casa.prototype.addRouteToMainServer = function(_route, _callback) {
   return app.get(_route, _callback);
};

Casa.prototype.addIoRouteToMainServer = function(_route, _callback) {
   return io.of(_route).on('connection', _callback);
};

module.exports = exports = Casa;
