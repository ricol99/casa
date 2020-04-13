var util = require('util');
var Source = require('./source');
var events = require('events');

function User(_config, _owner) {
   Source.call(this, _config, _owner);
};

util.inherits(User, Source);

module.exports = exports = User;
