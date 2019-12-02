var util = require('./util');
var Source = require('./source');

function Service(_config) {
   Source.call(this, _config);
   //this.config = _config;
   //this.uName = _config.uName;
   this.displayName = _config.displayName;
   //this.casa = this.gang.casa;
}

util.inherits(Service, Source);

Service.prototype.coldStart = function() {
};

module.exports = exports = Service;
