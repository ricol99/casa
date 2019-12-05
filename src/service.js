var util = require('./util');
var Source = require('./source');

function Service(_config) {

   if (!_config.hasOwnProperty("local")) {
      _config.local = true;
   }

   Source.call(this, _config);
   this.displayName = _config.displayName;
}

util.inherits(Service, Source);

module.exports = exports = Service;
