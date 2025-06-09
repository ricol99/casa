var util = require('../util');
var Service = require('../service');
var Gang = require('../gang');

function CasaDiscoveryService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.listeningPort = this.gang.casa.listeningPort;
   this.discoveryTransports = {};

   this.gang = Gang.mainInstance();
   this.gangId = this.gang.name;
   this.targetCasa = _config.targetCasa;
   this.casas = {};
   this.searching = false;
   this.mdnsDiscoveryTransport = new MdnsDiscoveryTransport(this, "mdns", "http", this.gang.casa.name, this.listeningPort, 1);
}

util.inherits(CasaDiscoveryService, Service);

CasaDiscoveryService.prototype.coldStart =  function() {

   for (var transportName in this.discoveryTransports) {

      if (this.discoveryTransports.hasOwnProperty(transportName)) {
         this.discoveryTransports[transportName].coldStart();
      }
   }
}

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

CasaDiscoveryService.prototype.casaStatusUpdate = function(_name, _status, _address, _discoveryTransportName, _messageTransportName, _tier) {
   var statusChanged = true;

   if (this.casas.hasOwnProperty(_name)) {

      if (this.casas[_name].discoveryTransports.hasOwnProperty(_discoveryTransportName)) {
         statusChanged = (this.casas[_name].discoveryTransports[_discoveryTransportName].status !== _status);
      }
   }
   else {
      this.casas[_name] = { discoveryTransports: {} };
   }

   this.casas[_name].discoveryTransports[_discoveryTransportName] = { name: _name, status: _status, address: _address, messageTransportName: _messageTransportName, tier: _tier };

   if (statusChanged && (!this.targetCasa || (this.targetCasa === _name))) {
      this.emit(_status === "up" ? "casa-up" : "casa-down", this.casas[_name].discoveryTransports[_discoveryTransportName]);
   }
};

function MdnsDiscoveryTransport(_owner, _name, _messageTransportName, _casaName, _listeningPort, _tier) {
   this.owner = _owner;
   this.name = _name;
   this.messageTransportName = _messageTransportName;
   this.casaName = _casaName;
   this.listeningPort = _listeningPort;
   this.tier = _tier;
   this.mdns = require('mdns');
   this.browser = null;

   this.name = this.owner.gang.casa.name;
   this.id = this.owner.gang.casa.name
   this.listeningPort = this.owner.gang.casa.listeningPort;
      
   // workaround for raspberry pi
   this.sequence = [
       this.mdns.rst.DNSServiceResolve(),
       'DNSServiceGetAddrInfo' in this.mdns.dns_sd ? this.mdns.rst.DNSServiceGetAddrInfo() : this.mdns.rst.getaddrinfo({families:[4]}),
       this.mdns.rst.makeAddressesUnique()
   ];

   this.owner.addDiscoveryTransport(this.name, this);
};

MdnsDiscoveryTransport.prototype.coldStart = function() {

   try {
      this.browser = this.mdns.createBrowser(this.mdns.tcp('casa'), { resolverSequence: this.sequence });

      this.browser.on('serviceUp', (_service) => {

         if (!util.exists(_service, [ "txtRecord", "name", "host", "port" ])) {
            console.error(this.owner.uName + ":" + this.name + ": service up - Malformed advert", _service);
            return;
         }

         if ((_service.txtRecord.gang === this.owner.gang.name) && (_service.name !== this.name)) {
            this.owner.casaStatusUpdate(_service.name, "up", { host: _service.host, port: _service.port }, this.name, this.messageTransportName, this.tier);
         }  
      });      
            
      this.browser.on('serviceDown', (_service) => {

         if (!util.exists(_service, "name")) {
            console.error(this.owner.uName + ":" + this.name + ": service down - Malformed advert", _service);
            return;
         }

         if (_service.name !== this.name) {
            this.owner.casaStatusUpdate(_service.name, "down", null, this.name, this.messageTransportName, this.tier);
         }
      });
   
   } catch (_err) {
      process.stderr.write('Error: ' + _err.message + '\n');
   }
}  

MdnsDiscoveryTransport.prototype.startSearching = function() {
   console.log(this.owner.uName + ":" + this.name + ": startSearching()");

   try {
      this.browser.start();
   } catch (_err) {
      console.error(this.owner.uName + ":" + this.name + ": Error: " + _err.message + "\n");
   }
};

MdnsDiscoveryTransport.prototype.stopSearching = function() {
   console.log(this.owner.uName + ":" + this.name + ": stopSearching()");

   try { 
      this.browser.stop();
   } catch (_err) {
      console.error(this.owner.uName + ":" + this.name + ": Error: " + _err.message + "\n");
   }
};

MdnsDiscoveryTransport.prototype.startBroadcasting = function() {
   console.log(this.owner.uName + ":" + this.name + ": startBroadcasting()");

   try {
      this.ad = this.mdns.createAdvertisement(this.mdns.tcp('casa'), this.listeningPort, { name: this.casaName, txtRecord: { id: this.casaName, gang: this.owner.gang.name }});

      this.ad.on('error', (_err) => {
         console.error(this.owner.uName + ":" + this.name + ": Not advertising service! Error: " + _err);
      });

      this.ad.start();
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
      this.ad.stop();
   }
   catch (_ex) {
     console.error(this.owner.uName + ":" + this.name + ": Not able to stop advertising service! Error: " + _ex);
   }
};

module.exports = exports = CasaDiscoveryService;
