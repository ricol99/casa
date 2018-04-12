var util = require('../util');

function Gang(_config) {
   this.secure = _config.secure;
   this.certs = _config.certPath;
}

Gang.prototype.inSecureMode = function() {
   return this.secure;
};

Gang.prototype.certPath = function() {
   return this.certs;
};

Gang.prototype.mainListeningPort = function() {
   return 8000; 
};

module.exports = exports = Gang;

