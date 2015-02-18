var util = require('util');
var Thing = require('./thing');

function User(_name, _displayName, _owner, _props) {

   if (_name.name) {
      // constructing from object rather than params
      Thing.call(this, _name.name, _name.displayName, _name.owner, _name.props);
   }
   else {
      Thing.call(this, _name, _displayName, _owner, _props);
   }
   var that = this;
}

util.inherits(User, Thing);

module.exports = exports = User;
