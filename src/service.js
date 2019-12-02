var util = require('./util');
var SourceBase = require('./sourcebase');

function Service(_config) {
   SourceBase.call(this);
   this.config = _config;
   this.uName = _config.uName;
   this.displayName = _config.displayName;
   this.casa = this.gang.casa;
}

util.inherits(Service, SourceBase);

Service.prototype.coldStart = function() {
};

module.exports = exports = Service;
