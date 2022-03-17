var util = require('./util');
var express;
var app;
var http;
var io;

var Gang = require('./gang');
var NamedObject = require('./namedobject');

function Casa(_config, _owner) {
   this._id = true;     // TDB!!!
   this.portStart = 50000;
   this.nextPortToAllocate = this.portStart;
   this.ports = {};
   this.connectToPeers = _config.connectToPeers;
   this.secureMode = _config.secureMode;
   this.certPath = _config.certPath;
   this.configPath = _config.configPath;
   this.gang = _owner;

   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.listeningPort;
   NamedObject.call(this, _config, _owner);

   this.id = _config.id;
   this.db = null;

   this.sources = {};
   this.serviceTypes = {};
   this.topSources = {};
   this.sourceListeners = {};
   this.bowingSources = {};

   this.uber = false;

   this.createServer();
}

util.inherits(Casa, NamedObject);

// Used to classify the type and understand where to load the javascript module
Casa.prototype.superType = function(_type) {
   return "casa";
};

Casa.prototype.buildServices = function() {

   this.createChildren(this.config.services, "service", this);

   for (var service in this.services) {

      if (this.services.hasOwnProperty(service)) {
         this.addServiceByType(this.services[service]);
      }
   }
};
  
Casa.prototype.buildTree = function() {
   this.createChildren(this.config.scenes, "scene", this);
   this.createChildren(this.config.things, "thing", this);

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].inheritChildProps();
      }
   }
};

// Called when system state is required
Casa.prototype.export = function(_exportObj) {

   if (NamedObject.prototype.export.call(this, _exportObj)) {
      _exportObj.secureMode = this.secureMode;
      _exportObj.certPath = this.certPath;
      _exportObj.configPath = this.configPath;
      _exportObj.listeningPort = this.listeningPort;
      _exportObj.id = this.id;
      return true;
   }

   return false;
};

Casa.prototype.getCasa = function() {
   return this;
};

Casa.prototype.interestInNewChild = function(_uName) {
};

Casa.prototype.coldStartServices = function() {
   console.log(this.uName + ': Cold starting services...');

   for (var serviceName in this.services) {

      if (this.services.hasOwnProperty(serviceName)) {
         console.log(this.uName + ': Cold starting service '+ this.services[serviceName].name);
         this.services[serviceName].coldStart();
      }
   }
};

Casa.prototype.coldStart = function() {
   console.log(this.uName + ': Cold starting services...');

   for (var thingName in this.things) {

      if (this.things.hasOwnProperty(thingName)) {
         console.log(this.uName + ': Cold starting thing '+ this.things[thingName].name);
         this.things[thingName].coldStart();
      }
   }
};

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
      var source = this.gang.findGlobalSource(req.params.source);

      if (source) {
         source.getAllProperties(allProps, true);
      }

      res.json(allProps);
   });

   io.of('/peercasa')
     .on('connection', (_socket) => {

      console.log('a casa has joined');
      var peerCasa = this.gang.createPeerCasa("anonymous-"+Date.now(), true);
      peerCasa.serveClient(_socket);
   });

};

Casa.prototype.startListening = function () {

   http.listen(this.listeningPort, () => {
      console.log('listening on *:' + this.listeningPort);
   });
};

Casa.prototype.refreshSourceListeners = function() {
   this.cancelScheduledRefreshSourceListeners();

   for (var sourceListenerName in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(sourceListenerName)) {
         this.sourceListeners[sourceListenerName].refreshSource();
      }
   }
};

Casa.prototype.cancelScheduledRefreshSourceListeners = function() {
   this.sourceListenerRefreshRequired = false;

   if (this.refreshSourceListenersTimeout) {
      clearTimeout(this.refreshSourceListenersTimeout);
      this.refreshSourceListenersTimeout = null;
   }
};

Casa.prototype.scheduleRefreshSourceListeners = function() {

   if (!this.sourceListenerRefreshRequired) {
      this.sourceListenerRefreshRequired = true;

      this.refreshSourceListenersTimeout = setTimeout( () => {
         this.refreshSourceListenersTimeout = null;
         this.gang.casa.refreshSourceListeners();
      }, 500);
   }
};

Casa.prototype.getDb = function() {
   return this.db;
};

Casa.prototype.refreshSimpleConfig = function() {
   var simpleConfig = {};
   simpleConfig = {};
   simpleConfig.name = this.name;
   simpleConfig.displayName = this.displayName;
   simpleConfig.gang = this.gang.uName;
   simpleConfig.sources = [];

   for (sourceName in this.sources) {

      if (this.sources.hasOwnProperty(sourceName)) {
         var source = this.sources[sourceName];

         if (!source.local) {
            var allProps = {};
            source.getAllProperties(allProps, true);
            simpleConfig.sources.push({ name: source.name, uName: source.uName, priority: source.hasOwnProperty('priority') ? source.priority : 0, properties: util.copy(allProps) });
         }
      }
   }

   return simpleConfig;
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

   var added = false;

   for (var source in this.topSources) {

      if (this.topSources.hasOwnProperty(source)) {

         if (_source.uName.startsWith(source)) {
            added = true;
            break;
         }
         else if (source.startsWith(_source.uName)) {
            delete this.topSources[source];
            this.topSources[_source.uName] = _source;
            added = true;
            break;
         }
      }
   }

   if (!added) {
      this.topSources[_source.uName] = _source;
   }

   this.scheduleRefreshSourceListeners();
};

Casa.prototype.renameSource = function(_source, _newName) {
   console.log(this.uName + ': Renaming source '  + _source.name + ' to ' + _newName);
   delete this.sources[_source.uName];
   _source.setName(_newName);
   this.sources[_source.uName] = _source;
};

Casa.prototype.removeSource = function(_source) {
   console.log(this.uName + ': Deleting source '  + _source.uName);
   this.emit('source-removed', { sourceName: _source.uName });

   this.gang.removeThing(_source);
   delete this.sources[_source.uName];
};

Casa.prototype.addSourceListener = function(_sourceListener) {
   console.log(this.uName + ": AAAA ****** New source listener added " + _sourceListener.uName);

   if (this.sourceListeners[_sourceListener.uName]) {
      console.log("***********SOURCELISTENER NAME CONFLICT***************" + _sourceListener.uName);
      process.exit(1);
   }

   console.log(this.uName + ': Source listener ' + _sourceListener.uName + ' added to casa');
   this.sourceListeners[_sourceListener.uName] = _sourceListener;
   this.scheduleRefreshSourceListeners();
};

Casa.prototype.removeSourceListener = function(_sourceListener) {
   console.log(this.uName + ": Casa.prototype.removeSourceListener() " + _sourceListener.uName);
   
   if (this.sourceListeners[_sourceListener.uName]) {
      delete this.sourceListeners[_sourceListener.uName];
      return true;
   }
   else {
      return false;
   }

   console.log(this.uName + ': Source listener ' + _sourceListener.uName + ' removed from casa');
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

Casa.prototype.addServiceByType = function(_service) {
   console.log(this.uName + ': Service '  + _service.name + ' added to casa ');

   if (this.serviceTypes[_service.type]) {
      console.log("***********SERVICE CONFLICT - Only one localservice per type allowed***************" + _service.name);
      process.exit(1);
   }

   this.serviceTypes[_service.type]  = _service;
};

Casa.prototype.findService = function(_serviceType) {
   return (_serviceType.startsWith("::")) ? this.gang.findNamedObject(_serviceType) : this.serviceTypes[_serviceType];
};

Casa.prototype.findServiceName = function(_serviceType) {
   var service = this.findService(_serviceType);

   return (service) ? service.uName : null;
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

Casa.prototype.getListeningPort = function() {
   return this.listeningPort;
};

Casa.prototype.getHost = function() {
   return util.getLocalIpAddress();
};

Casa.prototype.bowSource = function(_source, _currentlyActive) {
   console.log(this.uName + ": bowSource() Making source " + _source.uName + " passive"); 

   if (_currentlyActive) {
      _source.detach();
   }
   this.bowingSources[_source.uName] = _source;
};

Casa.prototype.standUpSourceFromBow = function(_source) {
   console.log(this.uName + ": standUpSourceFromBow() Making source " + _source.uName + " active");

   if (!this.gang.addNamedObject(_source)) {
      console.error(this.uName + ": standUpSourceFromBow() Unable to find owner for source=" + _source.uName);
      return;
   }

   delete this.bowingSources[_source.uName];
};

Casa.prototype.getBowingSource = function(_sourceFullName) {
   var bowingSource = null;

   for (var source in this.bowingSources) {

      if (this.bowingSources.hasOwnProperty(source) && source.startsWith(_sourceFullName)) {
         bowingSource = this.bowingSources[source].findNamedObject(_sourceFullName);
    
         if (bowingSource) {
            break;
         }
      }
   }

   return bowingSource;
};

module.exports = exports = Casa;
