var util = require('util');
var ServiceConsoleApi = require('./serviceconsoleapi');

function LightwaveRfServiceConsoleApi(_config, _owner) {
   ServiceConsoleApi.call(this, _config, _owner);

   this.hue = this.myObj().hue;
}

util.inherits(LightwaveRfServiceConsoleApi, ServiceConsoleApi);

LightwaveRfServiceConsoleApi.prototype.findBridges = function(_params, _callback) {
   this.checkParams(0, _params);
   _callback("Not currently supported!");
};

LightwaveRfServiceConsoleApi.prototype.findBridge = function(_params, _callback) {
   this.checkParams(0, _params);
   _callback("Not currently supported!");
};

LightwaveRfServiceConsoleApi.prototype.setLinkAddress = function(_params, _callback) {
   this.checkParams(1, _params);
   var linkAddress = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(this.myObjName, (_err, _hueServiceConfig) => {

         if (_err || (_hueServiceConfig === null)) {
            return _callback("Unable to persist link id!");
         }

         _hueServiceConfig.linkAddress = linkAddress;

         this.db.update(_hueServiceConfig, (_err2, _result) => {

            if (_err2) {
               return _callback("Unable to perist the link id");
            }

            this.myObj().linkAddress = linkAddress;
            this.myObj().registerWithLink(_callback);
         });
      });
   }
   else {
      this.myObj().linkAddress = linkAddress;
      this.myObj().registerWithLink(_callback);
   }

};

module.exports = exports = LightwaveRfServiceConsoleApi;
 
