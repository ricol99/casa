var util = require('util');
var Thing = require('./thing');

function CasaArea(_name, _displayName, _owner, _props) {

   Thing.call(this, 'casa-area:' + _name, _displayName, _owner, _props);
   var that = this;
}

util.inherits(CasaArea, Thing);

module.exports = exports = CasaArea;
