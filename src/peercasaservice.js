var util = require('util');
var events = require('events');
var PeerCasa = require('./peercasa');
var CasaSystem = require('./casasystem');

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
   this.gang = _config.gang;

   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   this.listeningPort = this.casa.listeningPort;
   this.uName = this.casa.uName;
   this.id = this.casa.id;

   if (!process.env.INTERNETCASA) {
      try {
         this.createAdvertisement();

         this.browser = mdns.createBrowser(mdns.tcp('casa'), {resolverSequence: sequence});
         //this.browser = mdns.createBrowser(mdns.tcp('casa'));

         this.browser.on('serviceUp', (service) => {
            console.log('peercasaservice: service up, casa=' + service.name + ' hostname=' + service.host + ' port=' + service.port);

            if ((!((this.gang || service.txtRecord.gang) && (service.txtRecord.gang != this.gang))) &&
               (service.name != this.casa.uName && !this.casaSys.remoteCasas[service.name])) {

               if (!this.casaSys.parentCasa || (this.casaSys.parentCasa.uName != service.name)) {
                  // Found a peer

                  // Only try to connect if we don't have a session already AND it is our role to connect and not wait
                  if ((!this.casaSys.remoteCasas[service.name]) && (service.name > this.casa.uName)) {
                     var peerCasa = this.casaSys.createPeerCasa({name: service.name});
                     peerCasa.connectToPeerCasa({ address: { hostname: service.host, port: service.port }});
                     console.log('peercasaservice: New peer casa: ' + peerCasa.uName);
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

PeerCasaService.prototype.createAdvertisement = function() {

   try {
     this.ad = mdns.createAdvertisement(mdns.tcp('casa'), this.listeningPort, {name: this.uName, txtRecord: { id: this.id, gang: this.gang }});
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
