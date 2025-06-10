var util = require('./util');
var express;
var app;
var http;
var io;
var exiting = false;

var Gang = require('./gang');
var NamedObject = require('./namedobject');
var _mainInstance = null;

process.on('exit', () => {
   aboutToExit();

   setTimeout(() => {
      process.exit();
   }, 2000);
});

process.on('SIGINT', () => {
   aboutToExit();

   setTimeout(() => {
      process.exit();
   }, 2000);
});

function aboutToExit() {

   if (!exiting) {
      exiting = true;

      if (_mainInstance) {
         _mainInstance.goingDown();
      }
   }
}

function Casa(_config, _owner) {
   _mainInstance = this;
   this._id = true;     // TDB!!!
   this.portStart = 50000;
   this.nextPortToAllocate = this.portStart;
   this.ports = {};
   this.connectToPeers = _config.connectToPeers;
   this.secureMode = _config.secureMode;
   this.certPath = _config.certPath;
   this.configPath = _config.configPath;
   this.logEvents = _config.logEvents;
   this.gang = _owner;

   this.listeningPort = (process.env.PORT) ? process.env.PORT : _config.listeningPort;
   NamedObject.call(this, _config, _owner);

   this.id = _config.id;
   this.db = null;

   this.sources = {};
   this.serviceTypes = {};
   this.topSources = {};
   this.bowingSources = {};
   this.queuePeerCasas = {};

   this.uber = false;

   this.sourcePropertyChangedCasaHandler = Casa.prototype.sourcePropertyChangedCasaCb.bind(this);
   this.sourceEventRaisedCasaHandler = Casa.prototype.sourceEventRaisedCasaCb.bind(this);
}

util.inherits(Casa, NamedObject);

// Used to classify the type and understand where to load the javascript module
Casa.prototype.superType = function(_type) {
   return "casa";
};

Casa.prototype.goingDown = function(_err) {

   if (this.services) {

      for (var serviceName in this.services) {
         this.services[serviceName].goingDown(_err);
      }
   }
};

Casa.prototype.sourcePropertyChangedCasaCb = function(_data) {
   console.log(this.uName + ': ' + _data.sourceName + ' has had a property change, prop='+_data.name+" value="+_data.value);
   this.emit('source-property-changed', _data);
};

Casa.prototype.sourceEventRaisedCasaCb = function(_data) {
   console.log(this.uName + ': ' + _data.sourceName + ' has raised an event, prop='+_data.name);
   this.emit('source-event-raised', _data);
};

Casa.prototype.buildServices = function() {
   var mainServerConfig = { name: "main-web-service", type: "webservice", delayStartListening: true, mainServer: true, secure: this.secureMode, socketIoSupported: true, port: this.listeningPort };
   this.createChild(mainServerConfig, "service", this);

   this.createChildren(this.config.services, "service", this);

   for (var service in this.services) {

      if (this.services.hasOwnProperty(service)) {
         this.addServiceByType(this.services[service]);
      }
   }

   this.eventLogger = this.findService("eventloggingservice");
   this.createServer();
};
  
Casa.prototype.buildTree = function() {
   this.createChildren(this.config.scenes, "scene", this);
   this.createChildren(this.config.things, "thing", this);
};

// Called when system state is required
Casa.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
};

// Called before hotStart to retsore system state
Casa.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
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

   this.mainWebService.addIoRoute('/peercasa', (_socket) => {
      console.log('a casa has joined');
      var peerCasa = this.gang.createPeerCasa("anonymous-"+Date.now(), true);
      peerCasa.serveClient(_socket);
   }, "all");
};

Casa.prototype.hotStart = function() {
   console.log(this.uName + ': Hot starting...');
   NamedObject.prototype.hotStart.call(this);
};

Casa.prototype.casaUp = function(_name, _address, _messageTransportName, _tier) {
   console.error(this.uName+": casaUp() name="+_name+", transport="+_messageTransportName+", tier="+_tier);

   // TBD AAA Hack to stop connection over pusher
   if (_tier === 1) {
      return;
   }

   // Should I reach out or do I wait for it to contact me?
   if (_name > this.name) {
      var peerCasa = this.gang.findPeerCasa(_name);

      if (!peerCasa) {
         this.createPeerCasa(_name, _address, _messageTransportName, _tier);
      }
      else if (peerCasa.discoveryTier > _tier) {
         peerCasa.disconnectFromClient();
         this.createPeerCasa(_name, _address, _messageTransportName, _tier);
      }
   }
};

Casa.prototype.casaDown = function(_name, _address, _messageTransportName, _tier) {
   console.error(this.uName+": casaDown() name="+_name+", tier="+_tier);
};

Casa.prototype.createPeerCasa = function(_name, _address, _messageTransportName, _tier) {
   console.error(this.uName + ": New peer casa: " + _name);
   var peerCasa = this.gang.createPeerCasa(_name);
   peerCasa.connectToPeerCasa({ address: _address, messageTransport: _messageTransportName, discoveryTier: _tier });
};

Casa.prototype.createServer = function() {
   this.mainWebService = this.findService(this.uName+":"+"main-web-service");

   this.mainWebService.addRoute('/index.html', (req, res) => {
     res.sendFile(__dirname + '/index.html');
   });

   this.mainWebService.addRoute('/configfile/:filename', (req, res) => {
      console.log(this.uName + ": Serving file " + req.params.filename);
      res.sendFile(this.configPath + '/' + req.params.filename);
   });

   this.mainWebService.addRoute('/source/:source', (req, res) => {
      var allProps = {};
      var source = this.gang.findNamedObject(req.params.source);

      if (source) {
         source.getAllProperties(allProps, true);
      }

      res.json(allProps);
   });

   var casaDiscoveryServiceName = this.gang.casa.findServiceName("casadiscoveryservice");
   this.casaDiscoveryService = casaDiscoveryServiceName ? this.gang.casa.findService(casaDiscoveryServiceName) : null;

   this.casaDiscoveryService.on("casa-up", (_data) => { this.casaUp(_data.name, _data.address, _data.messageTransportName, _data.tier) });
   this.casaDiscoveryService.on("casa-down", (_data) => { this.casaDown(_data.name, _data.address, _data.messageTransportName, _data.tier) });
};

Casa.prototype.startListening = function () {
   this.mainWebService.startListening();
   this.casaDiscoveryService.startSearchingAndBroadcasting();
};

Casa.prototype.refreshSourceListeners = function() {
   this.cancelScheduledRefreshSourceListeners();

   for (var sourceName in this.sources) {

      if (this.sources.hasOwnProperty(sourceName)) {
         this.sources[sourceName].refreshSourceListeners();
      }
   }

   for (var bowingSourceName in this.bowingSources) {

      if (this.bowingSources.hasOwnProperty(bowingSourceName)) {
         this.bowingSources[bowingSourceName].refreshSourceListeners();
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
            var allEvents = {};
            source.getAllProperties(allProps, true);
            source.getAllEvents(allEvents, true);
            simpleConfig.sources.push({ name: source.name, uName: source.uName, priority: source.hasOwnProperty('priority') ? source.priority : 0,
                                        properties: util.copy(allProps), events: util.copy(allEvents) });
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

   _source.on('property-changed', this.sourcePropertyChangedCasaHandler);
   _source.on('event-raised', this.sourceEventRaisedCasaHandler);

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

Casa.prototype.stopListeningToSource = function(_source) {
   _source.removeListener('source-property-changed', this.sourcePropertyChangedCasaHandler);
   _source.removeListener('event-raised', this.sourceEventRaisedCasaHandler);
};

Casa.prototype.startListeningToSource = function(_source) {
   _source.on('source-property-changed', this.sourcePropertyChangedCasaHandler);
   _source.on('event-raised', this.sourceEventRaisedCasaHandler);
};

Casa.prototype.addSourceListener = function(_sourceListener) {
   this.scheduleRefreshSourceListeners();
};

Casa.prototype.removeSourceListener = function(_sourceListener) {
   return false;
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
   return this.mainWebService.addRoute(_route, _callback);
};

Casa.prototype.addPostRouteToMainServer = function(_route, _callback) {
   return this.mainWebService.addPostRoute(_route, _callback);
};

Casa.prototype.addIoRouteToMainServer = function(_route, _callback, _transport) {
   return this.mainWebService.addIoRoute(_route, _callback, _transport);
};

Casa.prototype.mainWebService = function () {
   return this.mainWebService;
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
   this.stopListeningToSource(_source);
};

Casa.prototype.standUpSourceFromBow = function(_source) {
   console.log(this.uName + ": standUpSourceFromBow() Making source " + _source.uName + " active");

   if (!this.gang.addNamedObject(_source)) {
      console.error(this.uName + ": standUpSourceFromBow() Unable to find owner for source=" + _source.uName);
      return;
   }

   delete this.bowingSources[_source.uName];
   this.startListeningToSource(_source);
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
