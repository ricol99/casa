var assert = require('assert');
var http = require('http');
var util = require('../util');
var AsyncEmitter = require('../asyncemitter');
var CasaDiscoveryService = require('../services/casadiscoveryservice');
var IoMessageSocketService = require('../services/iomessagesocketservice');
var PeerGang = require('../peergang');
var PeerGangCasa = require('../peergangcasa');

function runAsyncTest(_name, _fn) {
   _fn(function(_err) {

      if (_err) {
         process.stderr.write("[FAIL] " + _name + "\n");
         process.stderr.write((_err && _err.stack) ? _err.stack : (_err + "\n"));
         process.exit(1);
      }

      process.stdout.write("[PASS] " + _name + "\n");
   });
}

function MemoryLanBus() {
   this.transports = {};
   this.deliveryDelayMs = 5;
}

MemoryLanBus.prototype.addressKey = function(_address) {

   if (typeof _address === "string") {
      return "casa:" + _address;
   }

   return "port:" + _address.port;
};

MemoryLanBus.prototype.register = function(_address, _casaName, _transport) {
   this.transports[this.addressKey(_address)] = _transport;
   this.transports[this.addressKey(_casaName)] = _transport;
};

MemoryLanBus.prototype.send = function(_message, _data) {
   var transport = this.transports[this.addressKey(_data.destAddress)];
   var payload = util.copy(_data, true);

   if (!transport) {
      throw new Error("No LAN transport registered for " + JSON.stringify(_data.destAddress));
   }

   payload.message = _message;

   setTimeout(function() {
      transport.asyncEmit(_message, payload);
   }, this.deliveryDelayMs);
};

function MemoryLanTransport(_bus, _address, _casaName) {
   AsyncEmitter.call(this);
   this.bus = _bus;
   this.address = _address;
   this.casaName = _casaName;
   this.bus.register(_address, _casaName, this);
}

util.inherits(MemoryLanTransport, AsyncEmitter);

MemoryLanTransport.prototype.sendMessage = function(_message, _data) {
   this.bus.send(_message, _data);
};

function RemoteSource(_gang, _casa) {
   AsyncEmitter.call(this);
   this.uName = ":building";
   this.gang = _gang;
   this.casa = _casa;
   this.properties = {
      "gate-open": {
         value: false,
         getValueType: function() {
            return "boolean";
         }
      }
   };
   this.events = {};
   this.subscriptionHandler = null;
}

util.inherits(RemoteSource, AsyncEmitter);

RemoteSource.prototype.hasProperty = function(_property) {
   return this.properties.hasOwnProperty(_property);
};

RemoteSource.prototype.getProperty = function(_property) {
   return this.properties[_property].value;
};

RemoteSource.prototype.setProperty = function(_property, _value) {
   this.properties[_property].value = _value;
   this.asyncEmit("property-changed", {
      sourceName: this.uName,
      name: _property,
      value: _value,
      valueType: this.properties[_property].getValueType()
   });
};

RemoteSource.prototype.subscriptionRegistered = function(_event, _subscription) {

   if ((_event === "property-changed") && _subscription &&
       (_subscription.property === "gate-open") && this.subscriptionHandler) {
      this.subscriptionHandler();
   }
};

function createIoMessageSocketService(_gang, _transport) {
   var service = Object.create(IoMessageSocketService.prototype);

   service.uName = _gang.casa.uName + ":iomessagesocketservice";
   service.gang = _gang;
   service.messageTransports = {};
   service.nextLocalSocketId = 0;
   service.addMessageTransport("http", _transport);

   return service;
}

function createCasa(_gangName, _casaName, _port, _bus) {
   var gang = {
      name: _gangName,
      scheduleRefreshSourceListeners: function() {},
      findNamedObject: function() {
         return null;
      }
   };
   var casa = {
      name: _casaName.replace(/^:/, ""),
      uName: _casaName,
      listeningPort: _port,
      secureMode: false
   };
   var address = { host: "127.0.0.1", port: _port };
   var transport = new MemoryLanTransport(_bus, address, _casaName);

   gang.casa = casa;
   var ioService = createIoMessageSocketService(gang, transport);

   casa.mainWebService = {
      newIoSocket: function(_address, _route, _secure, _messageTransportName) {
         var IoMessageSocket = IoMessageSocketService.__testExports.IoMessageSocket;
         var socket = new IoMessageSocket(ioService, ioService.messageTransports[_messageTransportName]);

         socket.connect(_address, _route, {
            connectingTimeout: 1,
            disconnectingTimeout: 1,
            heartbeat: 0
         });
         return socket;
      }
   };
   casa.findServiceName = function(_type) {
      return _type === "casadiscoveryservice" ? "discovery" : null;
   };
   casa.findService = function(_name) {
      return _name === "discovery" ? gang.casaDiscoveryService : null;
   };

   return {
      address: address,
      casa: casa,
      gang: gang,
      ioService: ioService,
      transport: transport
   };
}

function createDiscoveryService(_gang, _port) {
   var service = Object.create(CasaDiscoveryService.prototype);

   service.gang = _gang;
   service.listeningPort = _port;
   service.discoveryTransports = {};
   service.sourceOwnerRequests = {};
   service.nextSourceOwnerRequestId = 0;
   service.sourceOwnerRequestTimeoutMs = 1000;
   service.sourceOwnerRoute = "/casa/source-owner";
   service.sourceOwnerRouteRegistered = false;
   service.addDiscoveryTransport = function(_name, _transport) {
      this.discoveryTransports[_name] = _transport;
   };
   service.emit = function() {};

   return service;
}

function startSourceOwnerServer(_discoveryService, _callback) {
   var server = http.createServer(function(_req, _res) {

      if ((_req.method === "POST") && (_req.url === _discoveryService.sourceOwnerRoute)) {
         _discoveryService.sourceOwnerHttpRequestCb(_req, _res);
      }
      else {
         _res.statusCode = 404;
         _res.end();
      }
   });

   server.listen(0, "127.0.0.1", function() {
      _callback(null, server);
   });
};

function closeServer(_server, _callback) {

   if (!_server) {
      _callback();
      return;
   }

   _server.close(function(_err) {
      _callback(_err);
   });
}

function stopPeerGangHeartbeats(_peerGang, _remotePeerGangCasas) {

   for (var casaName in _peerGang.peerGangCasas) {

      if (_peerGang.peerGangCasas.hasOwnProperty(casaName)) {
         _peerGang.peerGangCasas[casaName].session.stopHeartbeat();
      }
   }

   for (var i = 0; i < _remotePeerGangCasas.length; ++i) {
      _remotePeerGangCasas[i].session.stopHeartbeat();
   }
}

runAsyncTest("PeerGang subscribes to a LAN discovered remote property over PeerGangCasa", function(_done) {
   var bus = new MemoryLanBus();
   var local = createCasa("main-house", ":home-controller", 50000, bus);
   var remote = createCasa("farm-gate", ":barn-controller", 50001, bus);
   var remotePeerGangCasas = [];
   var sourceOwnerServer = null;
   var finished = false;
   var remoteSource = new RemoteSource(remote.gang, remote.casa);
   var localDiscovery = createDiscoveryService(local.gang, local.address.port);
   var remoteDiscovery = createDiscoveryService(remote.gang, remote.address.port);
   var MdnsDiscoveryTransport = CasaDiscoveryService.__testExports.MdnsDiscoveryTransport;
   var mdnsTransport = new MdnsDiscoveryTransport(localDiscovery, "mdns", "http", "home-controller", local.address.port, 1);
   var peerGang = new PeerGang({ name: "farm-gate" }, local.gang);

   local.gang.casaDiscoveryService = localDiscovery;
   remote.gang.casaDiscoveryService = remoteDiscovery;
   remote.gang.findNamedObject = function(_uName) {
      return _uName === remoteSource.uName ? remoteSource : null;
   };
   remote.ioService.addIoRoute("/peergangcasa", "http", function(_socket) {
      var peerGangCasa = new PeerGangCasa({
         name: "anonymous-remote",
         localGang: remote.gang,
         localCasa: remote.casa
      }, remote.gang);

      remotePeerGangCasas.push(peerGangCasa);
      peerGangCasa.serveClient(_socket);
   });

   function finish(_err) {

      if (finished) {
         return;
      }

      finished = true;
      clearTimeout(timeout);
      stopPeerGangHeartbeats(peerGang, remotePeerGangCasas);
      closeServer(sourceOwnerServer, function(_closeErr) {
         _done(_err || _closeErr);
      });
   }

   var timeout = setTimeout(function() {
      finish(new Error("Timed out waiting for LAN peer gang property update"));
   }, 2000);

   startSourceOwnerServer(remoteDiscovery, function(_err, _server) {

      if (_err) {
         finish(_err);
         return;
      }

      sourceOwnerServer = _server;
      remoteDiscovery.listeningPort = sourceOwnerServer.address().port;
      bus.register({ host: "127.0.0.1", port: sourceOwnerServer.address().port }, remote.casa.uName, remote.transport);
      mdnsTransport.addGangCasaCandidate("farm-gate", ":barn-controller", "barn-controller", {
         host: "127.0.0.1",
         port: sourceOwnerServer.address().port
      });

      remoteSource.subscriptionHandler = function() {
         setTimeout(function() {
            remoteSource.setProperty("gate-open", true);
         }, 20);
      };

      var listener = {
         sourceEventName: "farm-gate::building:gate-open",
         sourceName: ":building",
         eventName: "gate-open",
         listeningToPropertyChange: true,
         subscription: { property: "gate-open" },
         refreshSource: function() {
            var source = peerGang.findNamedObject(this.sourceName);

            if (source && !this.bound) {
               this.bound = true;
               source.on("property-changed", function(_data) {

                  if (_data.name !== "gate-open") {
                     return;
                  }

                  if (_data.value !== true) {
                     return;
                  }

                  try {
                     assert.strictEqual(_data.sourceName, ":building");
                     assert.strictEqual(_data.valueType, "boolean");
                     assert.strictEqual(peerGang.findPeerGangCasa(":barn-controller").connected, true);
                     assert.ok(peerGang.findNamedObject(":building").hasProperty("gate-open"));
                     assert.strictEqual(remotePeerGangCasas.length, 1);
                  }
                  catch (_assertErr) {
                     finish(_assertErr);
                     return;
                  }

                  finish();
               });
            }
         }
      };

      peerGang.subscribeSourceListener(listener);
   });
});
