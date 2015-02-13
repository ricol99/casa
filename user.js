var util = require('util');
var Thing = require('./thing');

function User(_name, _displayName, _props) {
   this.displayName = _displayName;

   Thing.call(this, 'user:' + _name, _props);
   var that = this;
}

util.inherits(User, Thing);

module.exports = exports = User;
