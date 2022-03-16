var util = require('util');
var Source = require('./source');
var events = require('events');

function User(_config, _owner) {
   Source.call(this, _config, _owner);
};

util.inherits(User, Source);

// Used to classify the type and understand where to load the javascript module
User.prototype.superType = function(_type) {
   return "user";
};

module.exports = exports = User;
