var util = require('util');
var Source = require('./source');
var events = require('events');

function User(_config) {
   this.name = _config.name;
   Source.call(this, _config);

   var that = this;
};

util.inherits(User, Source);

module.exports = exports = User;
