var util = require('./util');
var AsyncEmitter = require('./asyncemitter');

function CasaFinder(_config) {
   this.gangId = _config.gang;
   this.targetCasa = _config.casa;
   this.casas = {};
   this.mdns = require('mdns');

   // workaround for raspberry pi
   this.sequence = [
       this.mdns.rst.DNSServiceResolve(),
       'DNSServiceGetAddrInfo' in this.mdns.dns_sd ? this.mdns.rst.DNSServiceGetAddrInfo() : this.mdns.rst.getaddrinfo({families:[4]}),
       this.mdns.rst.makeAddressesUnique()
   ];
}

util.inherits(CasaFinder, AsyncEmitter);

CasaFinder.prototype.coldStart =  function() {

   try {
      this.browser = this.mdns.createBrowser(this.mdns.tcp('casa'), { resolverSequence: this.sequence });

      this.browser.on('serviceUp', (_service) => {

         if ((!(_service.txtRecord.gang && (_service.txtRecord.gang != this.gangId))) && !this.casas.hasOwnProperty(_service.name)) {
            this.casas[_service.name] = { name: _service.name, host: _service.host, port: _service.port };

            if (!this.targetCasa || (this.targetCasa === _service.name)) {
               this.emit("casa-found", this.casas[_service.name]);
            }
         }
      });

      this.browser.on('serviceDown', (_service) => {
         delete this.casas[_service.name];

         if (!this.targetCasa || (this.targetCasa === _service.name)) {
            this.emit("casa-down", { name: _service.name });
         }
      });

   } catch (_err) {
      process.stderr.write('Error: ' + _err.message + '\n');
   }
}

CasaFinder.prototype.startSearching =  function() {

   try {
      this.browser.start();
   } catch (_err) {
      process.stderr.write('Error: ' + _err.message + '\n');
   }
};

CasaFinder.prototype.stopSearching =  function() {
   this.browser.stop();
};


module.exports = exports = CasaFinder;
