var util = require('../util');
var Service = require('../service');
var Gang = require('../gang');

function CasaDiscoveryService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.listeningPort = this.gang.casa.listeningPort;
   this.discoveryTransports = {};

   this.gang = Gang.mainInstance();
   this.gangId = this.gang.name;
   this.targetCasaName = _config.targetCasaName;
   this.casas = {};
   this.sourceOwnerRequests = {};
   this.nextSourceOwnerRequestId = 0;
   this.sourceOwnerRequestTimeoutMs = _config.sourceOwnerRequestTimeoutMs || 10000;
   this.sourceOwnerRoute = _config.sourceOwnerRoute || "/casa/source-owner";
   this.sourceOwnerRouteRegistered = false;
   this.searching = false;
   this.mdnsDiscoveryTransport = new MdnsDiscoveryTransport(this, "mdns", "http", this.gang.casa.name, this.listeningPort, 1);
}

util.inherits(CasaDiscoveryService, Service);

CasaDiscoveryService.prototype.coldStart =  function() {
   this.registerSourceOwnerRoute();

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].coldStart();
      }
   }
}

CasaDiscoveryService.prototype.registerSourceOwnerRoute = function() {

   if (this.sourceOwnerRouteRegistered || !this.gang || !this.gang.casa ||
       !this.gang.casa.mainWebService || (typeof this.gang.casa.mainWebService.addPostRoute !== "function")) {
      return;
   }

   this.gang.casa.mainWebService.addPostRoute(this.sourceOwnerRoute, CasaDiscoveryService.prototype.sourceOwnerHttpRequestCb.bind(this));
   this.sourceOwnerRouteRegistered = true;
};

CasaDiscoveryService.prototype.readJsonRequestBody = function(_req, _callback) {

   if (_req.body) {
      _callback(null, _req.body);
      return;
   }

   var body = "";

   _req.on("data", function(_chunk) {
      body = body + _chunk;
   });

   _req.on("end", function() {

      if (!body) {
         _callback(null, {});
         return;
      }

      try {
         _callback(null, JSON.parse(body));
      }
      catch (_err) {
         _callback(_err);
      }
   });
};

CasaDiscoveryService.prototype.sendSourceOwnerHttpResponse = function(_res, _status, _body) {

   if (typeof _res.status === "function") {
      _res.status(_status);
   }
   else {
      _res.statusCode = _status;
   }

   if (typeof _res.json === "function") {
      _res.json(_body);
   }
   else {
      _res.setHeader("content-type", "application/json");
      _res.end(JSON.stringify(_body));
   }
};

CasaDiscoveryService.prototype.sourceOwnerHttpRequestCb = function(_req, _res) {
   this.readJsonRequestBody(_req, (_err, _data) => {

      if (_err) {
         this.sendSourceOwnerHttpResponse(_res, 400, { ok: false, error: "invalid-json" });
         return;
      }

      if (!this.canServeSourceOwnerRequest(_data)) {
         this.sendSourceOwnerHttpResponse(_res, 404, {
            ok: false,
            requestId: _data ? _data.requestId : null,
            error: "source-owner-not-found"
         });
         return;
      }

      this.sendSourceOwnerHttpResponse(_res, 200, {
         ok: true,
         requestId: _data.requestId,
         gang: this.gang.name,
         uName: _data.uName,
         property: _data.property,
         event: _data.event,
         casaName: this.gang.casa.uName,
         address: {
            host: util.getLocalIpAddress(),
            port: this.listeningPort
         },
         messageTransportName: "http"
      });
   });
};

CasaDiscoveryService.prototype.setTargetCasa =  function(_targetCasaName) {
   this.targetCasaName = _targetCasaName;
};

CasaDiscoveryService.prototype.goingDown = function(_err) {

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].goingDown();
      }
   }
};

CasaDiscoveryService.prototype.startSearchingAndBroadcasting =  function() {
   this.startSearching();
   this.startBroadcasting();
};

CasaDiscoveryService.prototype.stopSearchingAndBroadcasting =  function() {
   this.stopSearching();
   this.stopBroadcasting();
};

CasaDiscoveryService.prototype.startSearching =  function() {

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].startSearching();
      }
   }

   this.searching = true;
};

CasaDiscoveryService.prototype.stopSearching =  function() {

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].stopSearching();
      }
   }

   this.searching = false;
};

CasaDiscoveryService.prototype.startBroadcasting =  function() {

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].startBroadcasting();
      }
   }

   this.broadcasting = true;
};

CasaDiscoveryService.prototype.stopBroadcasting =  function() {

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].stopBroadcasting();
      }
   }

   this.broadcasting = false;
};

CasaDiscoveryService.prototype.addDiscoveryTransport =  function(_name, _discoveryTransport) {
   this.discoveryTransports[_name] = _discoveryTransport;
};

CasaDiscoveryService.prototype.removeDiscoveryTransport =  function(_name) {

   if (this.discoveryTransports.hasOwnProperty(_name)) {

      if (this.searching) {
         this.discoveryTransports[_transportName].stopSearching();
      }
      delete this.discoveryTransports[_name];
   }
};

CasaDiscoveryService.prototype.casaStatusUpdate = function(_name, _status, _address, _discoveryTransportName, _messageTransportName, _tier, _metadata) {
   var statusChanged = true;
   var previousStatus = "down";
   var status;

   if (this.casas.hasOwnProperty(_name)) {

      if (this.casas[_name].discoveryTransports.hasOwnProperty(_discoveryTransportName)) {
         statusChanged = (this.casas[_name].discoveryTransports[_discoveryTransportName].status !== _status);
         previousStatus = this.casas[_name].discoveryTransports[_discoveryTransportName].status;
      }
   }
   else {
      this.casas[_name] = { discoveryTransports: {} };
   }

   status = { name: _name, status: _status, previousStatus: previousStatus,
              gang: this.gang.name, address: _address, discoveryTransportName: _discoveryTransportName,
              messageTransportName: _messageTransportName, tier: _tier };

   if (_metadata && (util.memberCount(_metadata) > 0)) {
      status.metadata = _metadata;
   }

   this.casas[_name].discoveryTransports[_discoveryTransportName] = status;

   if ((_status === "up") && !statusChanged) {
      // A service can come back without a prior serviceDown callback.
      // Re-emitting "casa-up" allows clients to recover stale/disconnected sockets.
      statusChanged = true;
   }

   if (statusChanged && (!this.targetCasaName || (this.targetCasaName === _name))) {
      this.emit(_status === "up" ? "casa-up" : "casa-down", this.casas[_name].discoveryTransports[_discoveryTransportName]);
   }
};

CasaDiscoveryService.prototype.gangCasaStatusUpdate = function(_gang, _name, _status, _address, _discoveryTransportName, _messageTransportName, _tier, _metadata) {
   var status = {
      gang: _gang,
      name: _name,
      casaName: _name,
      status: _status,
      address: _address,
      discoveryTransportName: _discoveryTransportName,
      messageTransportName: _messageTransportName,
      tier: _tier
   };

   if (_metadata && (util.memberCount(_metadata) > 0)) {
      status.metadata = _metadata;
   }

   this.emit(_status === "up" ? "gang-casa-up" : "gang-casa-down", status);
};

CasaDiscoveryService.prototype.createSourceOwnerRequestId = function() {
   return [
      this.gang.name,
      this.gang.casa.uName,
      Date.now(),
      this.nextSourceOwnerRequestId++
   ].join(":");
};

CasaDiscoveryService.prototype.discoverSourceOwner = function(_config, _callback) {
   var request = {
      requestId: _config.requestId || this.createSourceOwnerRequestId(),
      gang: _config.gang,
      uName: _config.uName || _config.sourceName,
      property: _config.property,
      event: _config.event
   };
   var transportCount = 0;

   if (!request.gang || !request.uName) {
      _callback(new Error("source owner discovery requires gang and uName"));
      return null;
   }

   this.sourceOwnerRequests[request.requestId] = {
      request: request,
      callback: _callback,
      timeout: setTimeout( (_requestId) => {
         this.sourceOwnerDiscoveryFailed(_requestId, new Error("source owner discovery timed out"));
      }, this.sourceOwnerRequestTimeoutMs, request.requestId)
   };

   if (this.sourceOwnerRequests[request.requestId].timeout.unref) {
      this.sourceOwnerRequests[request.requestId].timeout.unref();
   }

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName) &&
          (typeof this.discoveryTransports[transportName].discoverSourceOwner === "function")) {
         this.discoveryTransports[transportName].discoverSourceOwner(request);
         transportCount = transportCount + 1;
      }
   }

   if (transportCount === 0) {
      this.sourceOwnerDiscoveryFailed(request.requestId, new Error("no source owner discovery transports available"));
   }

   return request.requestId;
};

CasaDiscoveryService.prototype.sourceOwnerDiscoveryFailed = function(_requestId, _error) {
   var pending = this.sourceOwnerRequests[_requestId];

   if (!pending) {
      return;
   }

   clearTimeout(pending.timeout);
   delete this.sourceOwnerRequests[_requestId];
   pending.callback(_error);
};

CasaDiscoveryService.prototype.sourceOwnerStatusUpdate = function(_data, _discoveryTransportName, _messageTransportName, _tier) {
   var pending = _data && _data.requestId ? this.sourceOwnerRequests[_data.requestId] : null;

   if (!pending) {
      return;
   }

   if (!this.sourceOwnerResponseMatchesRequest(_data, pending.request)) {
      return;
   }

   clearTimeout(pending.timeout);
   delete this.sourceOwnerRequests[_data.requestId];
   pending.callback(null, {
      requestId: _data.requestId,
      gang: _data.gang,
      uName: _data.uName,
      property: _data.property,
      event: _data.event,
      casaName: _data.casaName,
      address: _data.address,
      messageTransportName: _messageTransportName,
      discoveryTransportName: _discoveryTransportName,
      tier: _tier
   });
};

CasaDiscoveryService.prototype.sourceOwnerResponseMatchesRequest = function(_data, _request) {
   return (_data.gang === _request.gang) &&
          (_data.uName === _request.uName) &&
          ((_data.property || null) === (_request.property || null)) &&
          ((_data.event || null) === (_request.event || null));
};

CasaDiscoveryService.prototype.canServeSourceOwnerRequest = function(_data) {

   if (!_data || (_data.gang !== this.gang.name) || !_data.uName) {
      return false;
   }

   var source = this.gang.findNamedObject(_data.uName);

   if (!source || (source.casa !== this.gang.casa)) {
      return false;
   }

   if (_data.property) {
      return (typeof source.hasProperty === "function") && source.hasProperty(_data.property);
   }

   if (_data.event) {
      return source.events && source.events.hasOwnProperty(_data.event);
   }

   return true;
};

const dnssd = require('dnssd');

function MdnsDiscoveryTransport(_owner, _name, _messageTransportName, _casaName, _listeningPort, _tier) {
   this.owner = _owner;
   this.discoveryTransportName = _name;
   this.name = _name;
   this.messageTransportName = _messageTransportName;
   this.casaName = _casaName;
   this.listeningPort = _listeningPort;
   this.tier = _tier;
   this.browser = null;
   this.name = this.owner.gang.casa.name;
   this.id = this.owner.gang.casa.name
   this.listeningPort = this.owner.gang.casa.listeningPort;
   this.searching = false;
   this.advertising = false;
   this.gangCasaCandidates = {};
   this.serviceNameToCandidateKey = {};
      
   this.owner.addDiscoveryTransport(this.name, this);
};

MdnsDiscoveryTransport.prototype.coldStart = function() {

   try {
      this.browser = new dnssd.Browser(dnssd.tcp('casa'));

      this.browser.on('serviceUp', (_service) => {

         if (!util.exists(_service, [ "txt", "name", "host", "port" ])) {
            console.error(this.owner.uName + ":" + this.name + ": service up - Malformed advert", _service);
            return;
         }

         this.serviceUp(_service);
      });      
            
      this.browser.on('serviceDown', (_service) => {

         if (!util.exists(_service, "name")) {
            console.error(this.owner.uName + ":" + this.name + ": service down - Malformed advert", _service);
            return;
         }

         this.serviceDown(_service);
      });
   
   } catch (_err) {
      process.stderr.write('Error: ' + _err.message + '\n');
   }
}  

MdnsDiscoveryTransport.prototype.normalizedHost = function(_host) {
   let hostnameArr = _host.split(' ');
   return (hostnameArr.length > 1) ? hostnameArr[0]+".local" : hostnameArr[0];
};

MdnsDiscoveryTransport.prototype.candidateKey = function(_gang, _casaName) {
   return _gang + ":" + _casaName;
};

MdnsDiscoveryTransport.prototype.isLocalAdvert = function(_gang, _casaName, _serviceName) {
   return (_gang === this.owner.gang.name) &&
          ((_casaName === this.owner.gang.casa.uName) || (_serviceName === this.name));
};

MdnsDiscoveryTransport.prototype.serviceUp = function(_service) {

   if (!_service.txt.gang) {
      return;
   }

   var gangName = _service.txt.gang;
   var casaName = _service.txt.casaUName || _service.txt.id || _service.name;
   var metadata = {};
   var statusMetadata = null;
   var address = {
      host: this.normalizedHost(_service.host),
      port: _service.port
   };

   if ((_service.txt.unreg === "true") || (_service.txt.unregistered === "true")) {
      metadata.unregistered = true;

      if (_service.txt.mac || _service.txt.macAddress) {
         metadata.macAddress = _service.txt.mac || _service.txt.macAddress;
      }
   }

   if (util.memberCount(metadata) > 0) {
      statusMetadata = metadata;
   }

   if (this.isLocalAdvert(gangName, casaName, _service.name)) {
      return;
   }

   this.addGangCasaCandidate(gangName, casaName, _service.name, address, statusMetadata);
   this.owner.gangCasaStatusUpdate(gangName, casaName, "up", address, this.discoveryTransportName, this.messageTransportName, this.tier, statusMetadata);

   if (metadata.unregistered) {
      this.owner.casaStatusUpdate(casaName, "up", address, this.discoveryTransportName, this.messageTransportName, this.tier, statusMetadata);
   }
   else if ((gangName === this.owner.gang.name) && (_service.name !== this.name)) {
      this.owner.casaStatusUpdate(_service.name, "up", address, this.discoveryTransportName, this.messageTransportName, this.tier);
   }
};

MdnsDiscoveryTransport.prototype.serviceDown = function(_service) {
   var key = this.serviceNameToCandidateKey[_service.name];
   var candidate = key ? this.gangCasaCandidates[key] : null;

   if (candidate) {
      delete this.gangCasaCandidates[key];
      delete this.serviceNameToCandidateKey[_service.name];
      this.owner.gangCasaStatusUpdate(candidate.gang, candidate.casaName, "down", candidate.address, this.discoveryTransportName, this.messageTransportName, this.tier, candidate.metadata);

      if (candidate.metadata && candidate.metadata.unregistered) {
         this.owner.casaStatusUpdate(candidate.casaName, "down", null, this.discoveryTransportName, this.messageTransportName, this.tier, candidate.metadata);
      }
      else if ((candidate.gang === this.owner.gang.name) && (_service.name !== this.name)) {
         this.owner.casaStatusUpdate(_service.name, "down", null, this.discoveryTransportName, this.messageTransportName, this.tier, candidate.metadata);
      }
   }
   else if (_service.name !== this.name) {
      this.owner.casaStatusUpdate(_service.name, "down", null, this.discoveryTransportName, this.messageTransportName, this.tier);
   }
};

MdnsDiscoveryTransport.prototype.addGangCasaCandidate = function(_gang, _casaName, _serviceName, _address, _metadata) {
   var key = this.candidateKey(_gang, _casaName);

   this.gangCasaCandidates[key] = {
      gang: _gang,
      casaName: _casaName,
      serviceName: _serviceName,
      address: _address,
      messageTransportName: this.messageTransportName,
      tier: this.tier
   };

   if (_metadata && (util.memberCount(_metadata) > 0)) {
      this.gangCasaCandidates[key].metadata = _metadata;
   }

   this.serviceNameToCandidateKey[_serviceName] = key;
};

MdnsDiscoveryTransport.prototype.discoverSourceOwner = function(_request) {

   for (var key in this.gangCasaCandidates) {

      if (this.gangCasaCandidates.hasOwnProperty(key) && (this.gangCasaCandidates[key].gang === _request.gang)) {
         this.querySourceOwnerCandidate(this.gangCasaCandidates[key], _request);
      }
   }
};

MdnsDiscoveryTransport.prototype.querySourceOwnerCandidate = function(_candidate, _request) {
   var http = require('http');
   var body = JSON.stringify(_request);
   var options = {
      host: _candidate.address.host,
      port: _candidate.address.port,
      path: this.owner.sourceOwnerRoute,
      method: "POST",
      headers: {
         "content-type": "application/json",
         "content-length": Buffer.byteLength(body)
      },
      timeout: 2000
   };
   var req = http.request(options, (_res) => {
      var responseBody = "";

      _res.on("data", function(_chunk) {
         responseBody = responseBody + _chunk;
      });

      _res.on("end", () => {
         this.sourceOwnerHttpResponse(_candidate, _request, _res.statusCode, responseBody);
      });
   });

   req.on("error", function() {});
   req.on("timeout", function() {
      req.destroy();
   });
   req.write(body);
   req.end();
};

MdnsDiscoveryTransport.prototype.sourceOwnerHttpResponse = function(_candidate, _request, _statusCode, _body) {
   var data = null;

   if (_statusCode < 200 || _statusCode >= 300) {
      return;
   }

   try {
      data = JSON.parse(_body);
   }
   catch (_err) {
      return;
   }

   if (!data || !data.ok) {
      return;
   }

   this.owner.sourceOwnerStatusUpdate({
      requestId: _request.requestId,
      gang: data.gang || _request.gang,
      uName: data.uName || _request.uName,
      property: data.property || _request.property,
      event: data.event || _request.event,
      casaName: data.casaName || _candidate.casaName,
      address: this.validAddress(data.address) ? data.address : _candidate.address
   }, this.discoveryTransportName, data.messageTransportName || this.messageTransportName, this.tier);
};

MdnsDiscoveryTransport.prototype.validAddress = function(_address) {
   return _address && _address.host && _address.port;
};

MdnsDiscoveryTransport.prototype.goingDown = function() {

   if (this.advertising) {
      this.ad.stop();
   }

   if (this.searching) {
      this.browser.stop();
   }
};

MdnsDiscoveryTransport.prototype.startSearching = function() {
   console.log(this.owner.uName + ":" + this.name + ": startSearching()");

   try {
      this.browser.start();
      this.searching = true;
   } catch (_err) {
      console.error(this.owner.uName + ":" + this.name + ": Error: " + _err.message + "\n");
   }
};

MdnsDiscoveryTransport.prototype.stopSearching = function() {
   console.log(this.owner.uName + ":" + this.name + ": stopSearching()");

   try { 
      this.searching = false;
      this.browser.stop();
   } catch (_err) {
      console.error(this.owner.uName + ":" + this.name + ": Error: " + _err.message + "\n");
   }
};

MdnsDiscoveryTransport.prototype.startBroadcasting = function() {
   console.log(this.owner.uName + ":" + this.name + ": startBroadcasting()");

   try {
      this.ad = new dnssd.Advertisement(dnssd.tcp('casa'), this.listeningPort, {
         name: this.casaName,
         txt: {
            id: this.casaName,
            casaUName: this.owner.gang.casa.uName,
            gang: this.owner.gang.name,
            unreg: this.owner.gang.isUnregistered && this.owner.gang.isUnregistered() ? "true" : "false",
            mac: util.getLocalMacAddress ? (util.getLocalMacAddress() || "") : ""
         }
      });
 
      this.ad.on('error', (_err) => {
         console.error(this.owner.uName + ":" + this.name + ": Not advertising service! Error: " + _err);
      });

      this.ad.start();
      this.advertising = true;
   }
   catch (_ex) {
     console.error(this.owner.uName + ":" + this.name + ": Not advertising service! Error: " + _ex);
   }
};

MdnsDiscoveryTransport.prototype.stopBroadcasting = function() {
   console.log(this.owner.uName + ":" + this.name + ": stopBroadcasting()");

   if (!this.ad) {
      return;
   }

   try {
      this.advertising = false;
      this.ad.stop();
      this.ad = null;
   }
   catch (_ex) {
     console.error(this.owner.uName + ":" + this.name + ": Not able to stop advertising service! Error: " + _ex);
   }
};

module.exports = exports = CasaDiscoveryService;
module.exports.__testExports = {
   MdnsDiscoveryTransport: MdnsDiscoveryTransport
};
