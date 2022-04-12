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

// Called when current state required
User.prototype.export = function(_exportObj) {
   Source.prototype.export.call(this, _exportObj);
};

// Called when current state required
User.prototype.import = function(_importObj) {
   Source.prototype.import.call(this, _importObj);
};

User.prototype.coldStart = function() {
   Source.prototype.coldStart.call(this);
};

User.prototype.hotStart = function() {
   Source.prototype.hotStart.call(this);
};

module.exports = exports = User;
