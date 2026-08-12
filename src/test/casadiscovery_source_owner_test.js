var assert = require('assert');
var CasaDiscoveryService = require('../services/casadiscoveryservice');

function runTest(_name, _fn) {
   try {
      _fn();
      process.stdout.write("[PASS] " + _name + "\n");
   }
   catch (_err) {
      process.stderr.write("[FAIL] " + _name + "\n");
      process.stderr.write(_err.stack + "\n");
      process.exit(1);
   }
}

function createService() {
   var requests = [];
   var emitted = [];
   var routes = {};
   var service = Object.create(CasaDiscoveryService.prototype);

   service.gang = {
      name: "farm-gate",
      casa: {
         uName: ":barn-controller",
         mainWebService: {
            addPostRoute: function(_route, _handler) {
               routes[_route] = _handler;
            }
         }
      },
      findNamedObject: function() {
         return null;
      }
   };
   service.discoveryTransports = {
      pusher: {
         discoverSourceOwner: function(_request) {
            requests.push(_request);
         }
      }
   };
   service.sourceOwnerRequests = {};
   service.nextSourceOwnerRequestId = 0;
   service.sourceOwnerRequestTimeoutMs = 10000;
   service.sourceOwnerRoute = "/casa/source-owner";
   service.sourceOwnerRouteRegistered = false;
   service.emit = function(_eventName, _data) {
      emitted.push({ eventName: _eventName, data: _data });
   };

   return {
      emitted: emitted,
      requests: requests,
      routes: routes,
      service: service
   };
}

runTest("CasaDiscoveryService dispatches source owner requests and completes from transport response", function() {
   var harness = createService();
   var callbackData = null;
   var requestId = harness.service.discoverSourceOwner({
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   }, function(_err, _data) {
      callbackData = { err: _err, data: _data };
   });

   assert.strictEqual(harness.requests.length, 1);
   assert.strictEqual(harness.requests[0].requestId, requestId);
   assert.strictEqual(harness.requests[0].gang, "farm-gate");
   assert.strictEqual(harness.requests[0].uName, ":building");
   assert.strictEqual(harness.requests[0].property, "gate-open");

   harness.service.sourceOwnerStatusUpdate({
      requestId: requestId,
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller"
   }, "pusher", "pusher", 2);

   assert.strictEqual(callbackData.err, null);
   assert.strictEqual(callbackData.data.address, "gang-casa://farm-gate/:barn-controller");
   assert.strictEqual(callbackData.data.messageTransportName, "pusher");
   assert.strictEqual(harness.service.sourceOwnerRequests.hasOwnProperty(requestId), false);
});

runTest("CasaDiscoveryService reports missing source owner transports", function() {
   var harness = createService();
   var callbackError = null;

   harness.service.discoveryTransports = {};
   harness.service.discoverSourceOwner({
      gang: "farm-gate",
      uName: ":building"
   }, function(_err) {
      callbackError = _err;
   });

   assert.ok(callbackError);
   assert.strictEqual(callbackError.message, "no source owner discovery transports available");
});

runTest("CasaDiscoveryService ignores source owner responses that do not match the request", function() {
   var harness = createService();
   var callbackData = null;
   var requestId = harness.service.discoverSourceOwner({
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   }, function(_err, _data) {
      callbackData = { err: _err, data: _data };
   });

   harness.service.sourceOwnerStatusUpdate({
      requestId: requestId,
      gang: "farm-gate",
      uName: ":building",
      property: "other-property",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller"
   }, "pusher", "pusher", 2);

   assert.strictEqual(callbackData, null);
   assert.strictEqual(harness.service.sourceOwnerRequests.hasOwnProperty(requestId), true);

   harness.service.sourceOwnerStatusUpdate({
      requestId: requestId,
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller"
   }, "pusher", "pusher", 2);

   assert.strictEqual(callbackData.err, null);
   assert.strictEqual(callbackData.data.address, "gang-casa://farm-gate/:barn-controller");
});

runTest("CasaDiscoveryService emits gang-casa status separately from casa status", function() {
   var harness = createService();

   harness.service.gangCasaStatusUpdate("farm-gate", ":barn-controller", "up", "gang-casa://farm-gate/:barn-controller", "pusher", "pusher", 2);
   harness.service.gangCasaStatusUpdate("farm-gate", ":barn-controller", "down", "gang-casa://farm-gate/:barn-controller", "pusher", "pusher", 2);

   assert.deepStrictEqual(harness.emitted[0], {
      eventName: "gang-casa-up",
      data: {
         gang: "farm-gate",
         name: ":barn-controller",
         casaName: ":barn-controller",
         status: "up",
         address: "gang-casa://farm-gate/:barn-controller",
         discoveryTransportName: "pusher",
         messageTransportName: "pusher",
         tier: 2
      }
   });
   assert.strictEqual(harness.emitted[1].eventName, "gang-casa-down");
});

runTest("CasaDiscoveryService canServeSourceOwnerRequest checks gang owner and property", function() {
   var harness = createService();
   var source = {
      casa: harness.service.gang.casa,
      hasProperty: function(_property) {
         return _property === "gate-open";
      },
      events: {
         fault: true
      }
   };

   harness.service.gang.findNamedObject = function(_uName) {
      return _uName === ":building" ? source : null;
   };

   assert.strictEqual(harness.service.canServeSourceOwnerRequest({
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   }), true);
   assert.strictEqual(harness.service.canServeSourceOwnerRequest({
      gang: "farm-gate",
      uName: ":building",
      property: "missing"
   }), false);
   assert.strictEqual(harness.service.canServeSourceOwnerRequest({
      gang: "farm-gate",
      uName: ":building",
      event: "fault"
   }), true);
   assert.strictEqual(harness.service.canServeSourceOwnerRequest({
      gang: "other-gang",
      uName: ":building",
      property: "gate-open"
   }), false);
});

runTest("CasaDiscoveryService registers HTTP source owner route and answers local owner requests", function() {
   var harness = createService();
   var source = {
      casa: harness.service.gang.casa,
      hasProperty: function(_property) {
         return _property === "gate-open";
      },
      events: {}
   };
   var response = {
      statusCode: null,
      body: null,
      status: function(_statusCode) {
         this.statusCode = _statusCode;
         return this;
      },
      json: function(_body) {
         this.body = _body;
      }
   };

   harness.service.listeningPort = 51000;
   harness.service.gang.findNamedObject = function(_uName) {
      return _uName === ":building" ? source : null;
   };

   harness.service.registerSourceOwnerRoute();
   assert.strictEqual(typeof harness.routes["/casa/source-owner"], "function");

   harness.routes["/casa/source-owner"]({
      body: {
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":building",
         property: "gate-open"
      }
   }, response);

   assert.strictEqual(response.statusCode, 200);
   assert.strictEqual(response.body.ok, true);
   assert.strictEqual(response.body.requestId, "request-1");
   assert.strictEqual(response.body.gang, "farm-gate");
   assert.strictEqual(response.body.uName, ":building");
   assert.strictEqual(response.body.casaName, ":barn-controller");
   assert.strictEqual(response.body.messageTransportName, "http");
   assert.strictEqual(response.body.address.port, 51000);
});

runTest("CasaDiscoveryService HTTP source owner route rejects missing owners", function() {
   var harness = createService();
   var response = {
      statusCode: null,
      body: null,
      status: function(_statusCode) {
         this.statusCode = _statusCode;
         return this;
      },
      json: function(_body) {
         this.body = _body;
      }
   };

   harness.service.sourceOwnerHttpRequestCb({
      body: {
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":missing",
         property: "gate-open"
      }
   }, response);

   assert.strictEqual(response.statusCode, 404);
   assert.strictEqual(response.body.ok, false);
   assert.strictEqual(response.body.requestId, "request-1");
});

function createMdnsTransportHarness() {
   var statusUpdates = [];
   var gangCasaUpdates = [];
   var sourceOwnerResponses = [];
   var service = {
      uName: ":discovery",
      sourceOwnerRoute: "/casa/source-owner",
      addDiscoveryTransport: function() {},
      casaStatusUpdate: function(_name, _status, _address, _discoveryTransportName, _messageTransportName, _tier) {
         statusUpdates.push({
            name: _name,
            status: _status,
            address: _address,
            discoveryTransportName: _discoveryTransportName,
            messageTransportName: _messageTransportName,
            tier: _tier
         });
      },
      gangCasaStatusUpdate: function(_gang, _name, _status, _address, _discoveryTransportName, _messageTransportName, _tier) {
         gangCasaUpdates.push({
            gang: _gang,
            name: _name,
            status: _status,
            address: _address,
            discoveryTransportName: _discoveryTransportName,
            messageTransportName: _messageTransportName,
            tier: _tier
         });
      },
      sourceOwnerStatusUpdate: function(_data, _discoveryTransportName, _messageTransportName, _tier) {
         sourceOwnerResponses.push({
            data: _data,
            discoveryTransportName: _discoveryTransportName,
            messageTransportName: _messageTransportName,
            tier: _tier
         });
      },
      gang: {
         name: "main-house",
         casa: {
            name: "home-controller",
            uName: ":home-controller",
            listeningPort: 50000
         }
      }
   };
   var MdnsDiscoveryTransport = CasaDiscoveryService.__testExports.MdnsDiscoveryTransport;
   var transport = new MdnsDiscoveryTransport(service, "mdns", "http", "home-controller", 50000, 1);

   return {
      gangCasaUpdates: gangCasaUpdates,
      service: service,
      sourceOwnerResponses: sourceOwnerResponses,
      statusUpdates: statusUpdates,
      transport: transport
   };
}

runTest("mDNS discovery emits gang-casa status and records LAN candidates", function() {
   var harness = createMdnsTransportHarness();
   var serviceUp = {
      name: "barn-controller",
      host: "barn.local",
      port: 51000,
      txt: {
         gang: "farm-gate",
         casaUName: ":barn-controller"
      }
   };

   harness.transport.serviceUp(serviceUp);

   assert.deepStrictEqual(harness.gangCasaUpdates[0], {
      gang: "farm-gate",
      name: ":barn-controller",
      status: "up",
      address: { host: "barn.local", port: 51000 },
      discoveryTransportName: "mdns",
      messageTransportName: "http",
      tier: 1
   });
   assert.deepStrictEqual(harness.transport.gangCasaCandidates["farm-gate::barn-controller"], {
      gang: "farm-gate",
      casaName: ":barn-controller",
      serviceName: "barn-controller",
      address: { host: "barn.local", port: 51000 },
      messageTransportName: "http",
      tier: 1
   });

   harness.transport.serviceDown({ name: "barn-controller" });
   assert.strictEqual(harness.gangCasaUpdates[1].status, "down");
   assert.strictEqual(harness.transport.gangCasaCandidates.hasOwnProperty("farm-gate::barn-controller"), false);
});

runTest("mDNS discovery queries LAN candidates for source owners", function() {
   var harness = createMdnsTransportHarness();
   var queries = [];

   harness.transport.addGangCasaCandidate("farm-gate", ":barn-controller", "barn-controller", { host: "barn.local", port: 51000 });
   harness.transport.addGangCasaCandidate("other-gang", ":other-controller", "other-controller", { host: "other.local", port: 51001 });
   harness.transport.querySourceOwnerCandidate = function(_candidate, _request) {
      queries.push({ candidate: _candidate, request: _request });
   };

   harness.transport.discoverSourceOwner({
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   });

   assert.strictEqual(queries.length, 1);
   assert.strictEqual(queries[0].candidate.casaName, ":barn-controller");
   assert.strictEqual(queries[0].request.requestId, "request-1");
});

runTest("mDNS discovery forwards successful HTTP source owner responses", function() {
   var harness = createMdnsTransportHarness();
   var candidate = {
      gang: "farm-gate",
      casaName: ":barn-controller",
      address: { host: "barn.local", port: 51000 }
   };
   var request = {
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   };

   harness.transport.sourceOwnerHttpResponse(candidate, request, 200, JSON.stringify({
      ok: true,
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      casaName: ":barn-controller",
      address: { host: "barn.local", port: 51000 },
      messageTransportName: "http"
   }));

   assert.deepStrictEqual(harness.sourceOwnerResponses[0], {
      data: {
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":building",
         property: "gate-open",
         event: undefined,
         casaName: ":barn-controller",
         address: { host: "barn.local", port: 51000 }
      },
      discoveryTransportName: "mdns",
      messageTransportName: "http",
      tier: 1
   });
});

runTest("mDNS discovery falls back to candidate address when HTTP response omits host", function() {
   var harness = createMdnsTransportHarness();
   var candidate = {
      gang: "farm-gate",
      casaName: ":barn-controller",
      address: { host: "barn.local", port: 51000 }
   };
   var request = {
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   };

   harness.transport.sourceOwnerHttpResponse(candidate, request, 200, JSON.stringify({
      ok: true,
      casaName: ":barn-controller",
      address: { port: 51000 },
      messageTransportName: "http"
   }));

   assert.deepStrictEqual(harness.sourceOwnerResponses[0].data.address, { host: "barn.local", port: 51000 });
});

process.stdout.write("All casadiscovery source owner tests passed.\n");
