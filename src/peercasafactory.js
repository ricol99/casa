var util = require('util');
var Thing = require('./thing');
var PeerCasa = require('./peercasa');
var CasaSystem = require('./casasystem');

var mdns = require('mdns');

function PeerCasaFactory(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   this.gang = _config.gang;

   this.browser = mdns.createBrowser(mdns.tcp('casa'));

   var that = this;

   this.browser.on('serviceUp', function(service) {
      console.log('service up: casa=' + service.name + ' hostname=' + service.host + ' port=' + service.port);

      if ((!((that.gang || service.txtRecord.gang) && (service.txtRecord.gang != that.gang))) &&
         (service.name != that.casa.name && !that.casaSys.remoteCasas[service.name])) {

         if (!that.casaSys.parentCasa || (that.casaSys.parentCasa.name != service.name)) {
            // Found a peer
            var config  = {
               name: service.name,
               proActiveConnect: true,
               address: { hostname: service.host, port: service.port }
            };
            var peerCasa = new PeerCasa(config);
            that.casaSys.remoteCasas[peerCasa.name] = peerCasa;
            that.casaSys.allObjects[peerCasa.name] = peerCasa;
            peerCasa.start();
            console.log('New peer casa: ' + peerCasa.name);
         }
      }
   });

   this.browser.on('serviceDown', function(service) {
      console.log('service down: casa=' + service.name);
   });

   setTimeout(function() {
      that.browser.start();
   }, 10000);
}

module.exports = exports = PeerCasaFactory;
