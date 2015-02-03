var util = require('util');
var Thing = require('./thing');

function User(_name, _displayName, _props) {
   this.displayName = _displayName;
   this.props = _props;

   Thing.call(this, 'user:' + _name);
   var that = this;
}

util.inherits(User, Thing);

User.prototype.getProperty = function(_propName) {
   return this.props[_propName];
};


module.exports = exports = User;
