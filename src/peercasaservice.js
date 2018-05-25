var util = require('./util');
var events = require('events');
var PeerCasa = require('./peercasa');
var Gang = require('./gang');

if (!process.env.INTERNETCASA) {
   var mdns = require('mdns');

   // workaround for raspberry pi
   var sequence = [
       mdns.rst.DNSServiceResolve(),
       'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[4]}),
       mdns.rst.makeAddressesUnique()
   ];
}

function PeerCasaService(_config) {
   this.gang = Gang.mainInstance();
   this.queuedPeers = [];

   this.uName = this.gang.config.uName;
   this.id = this.gang.config.uName
   this.listeningPort = this.gang.config.listeningPort;
   this.inFetchDbMode = _config.fetchDbMode;
   this.casasBeingEstablished = {};

   this.dbService =  this.gang.findService("dbservice");

   if (!process.env.INTERNETCASA) {
      try {
         if (!this.inFetchDbMode) {
            this.createAdvertisement();
         }
         this.browser = mdns.createBrowser(mdns.tcp('casa'), {resolverSequence: sequence});

         this.browser.on('serviceUp', (service) => {
            console.log('peercasaservice: service up, casa=' + service.name + ' hostname=' + service.host + ' port=' + service.port);

            if ((!((this.gang.uName || service.txtRecord.gang) && (service.txtRecord.gang != this.gang.uName))) &&
               (service.name != this.uName && !this.gang.remoteCasas[service.name])) {

               if (!this.gang.parentCasa || (this.gang.parentCasa.uName != service.name)) {
                  // Found a peer

                  // Only try to connect if we don't have a session already AND it is our role to connect and not wait
                  if (!this.gang.remoteCasas[service.name] && !this.casasBeingEstablished[service.name]) {

                     if (this.inFetchDbMode) {
                        this.dbService.updateGangDbFromPeer(service.host, service.port, (_err, _res) => {
                           this.dbCallback(_err, _res);
                           this.dbCallback = null;
                        });
                     }
                     else if (service.name > this.uName) {
                        this.casasBeingEstablished[service.name] = true;
                        this.establishConnectionWithPeer(service);
                     }
                  }
               }
            }
         });

         this.browser.on('serviceDown', (service) => {
            console.log('peercasaservice: service down: casa=' + service.name);
         });

         this.browser.start();
      } catch (_err) {
         // Not scheduled during time period
         console.log('peercasaservice: Error: ' + _err.message);
      }
   }
}

PeerCasaService.prototype.setDbCallback = function(_dbCallback) {
   this.dbCallback = _dbCallback;
};

PeerCasaService.prototype.exitFetchDbMode = function() {
   this.inFetchDbMode = false;
   this.dbCallback = null;
   this.createAdvertisement(); 
   this.dequeueMissedRequests();
};

PeerCasaService.prototype.dequeueMissedRequests = function() {

   for (var i = 0; i < this.queuedPeers.length; ++i) {
      this.createPeerCasa(this.queuedPeers[i]);
   }
};

PeerCasaService.prototype.establishConnectionWithPeer = function(_service) {

   if (this.dbService) {

      this.dbService.checkGangDbAgainstPeer(_service.host, _service.port, (_err, _res) => {

         if (_err) {
            console.error(this.uName + ": Unable to check dbs against each other. Error: " + _err);
            this.createPeerCasa(_service);
         }
         else {
            if (_res.identical) {
               console.log("AAAAAAAAAAAA THE SAME!", _res);
               this.createPeerCasa(_service);
            }
            else if (_res.localNewer) {
               console.log("AAAAAAAAAAAA I AM NEWER!");
               this.createPeerCasa(_service, true);
            }
            else {
               console.log("AAAAAAAAAAAA I AM OLDER!");
               this.dbService.updateGangDbFromPeer(_service.host, _service.port, (_err, _res) => {

                  if (_err) {
                     console.error(this.uName + ": Unable to update my gang db from peer. Error: " + _err);
                     this.createPeerCasa(_service);
                  }
                  else {
                     // Exit, we have to restart with new Db
                     process.exit(2);
                  }
               });
            }
         }
      });
   }
   else {
      this.createPeerCasa(_service);
   }
};

PeerCasaService.prototype.createPeerCasa = function(_service) {

   if (!this.inFetchDbMode) {
      var peerCasa = this.gang.createPeerCasa({uName: _service.name});
      peerCasa.connectToPeerCasa({ address: { hostname: _service.host, port: _service.port }});
      this.casasBeingEstablished[_service.name] = null;
      delete this.casasBeingEstablished[_service.name];
      console.log('peercasaservice: New peer casa: ' + peerCasa.uName);
   }
   else {
      this.queuedPeers.push(util.copy(_service));
   }
};

PeerCasaService.prototype.createAdvertisement = function() {

   try {
     this.ad = mdns.createAdvertisement(mdns.tcp('casa'), this.listeningPort, {name: this.uName, txtRecord: { id: this.id, gang: this.gang.uName }});
     this.ad.on('error', (_err) => {
        console.log('peercasaservice: Not advertising service! Error: ' + _err);
     });
     this.ad.start();
   }
   catch (_ex) {
     console.log('peercasaservice: Not advertising service! Error: ' + _ex);
   }
}

module.exports = exports = PeerCasaService;
