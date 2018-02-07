var util = require('util');
var Source = require('./source');
var events = require('events');

function User(_config) {
   Source.call(this, _config);
};

util.inherits(User, Source);

module.exports = exports = User;
