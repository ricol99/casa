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

         var that = this;

         this.browser.on('serviceUp', function(service) {
            console.log('service up: casa=' + service.name + ' hostname=' + service.host + ' port=' + service.port);

            if ((!((that.gang || service.txtRecord.gang) && (service.txtRecord.gang != that.gang))) &&
               (service.name != that.casa.uName && !that.casaSys.remoteCasas[service.name])) {

               if (!that.casaSys.parentCasa || (that.casaSys.parentCasa.uName != service.name)) {
                  // Found a peer
                  var config  = {
                     name: service.name,
                     proActiveConnect: true,
                     address: { hostname: service.host, port: service.port }
                  };

                  // Only try to connect if we don't have a session already AND it is our role to connect and not wait
                  if ((!that.casaSys.remoteCasas[service.name]) && (service.name > that.casa.uName)) {
                     var peerCasa = that.casaSys.createPeerCasa(config);
                     peerCasa.start();
                     console.log('New peer casa: ' + peerCasa.uName);
                  }
               }
            }
         });

         this.browser.on('serviceDown', function(service) {
            console.log('service down: casa=' + service.name);
         });

         that.browser.start();
      } catch (_err) {
         // Not scheduled during time period
         console.log(this.uName + ': Error: ' + _err.message);
      }
   }
}

PeerCasaService.prototype.createAdvertisement = function() {
   try {
     this.ad = mdns.createAdvertisement(mdns.tcp('casa'), this.listeningPort, {name: this.uName, txtRecord: { id: this.id, gang: this.gang }});
     this.ad.on('error', function(err) {
        console.log('Not advertising service! Error: ' + err);
     });
     this.ad.start();
   }
   catch (ex) {
     console.log('Not advertising service! Error: ' + ex);
   }
}

module.exports = exports = PeerCasaService;
