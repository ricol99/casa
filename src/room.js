var util = require('util');
var Thing = require('./thing');

function Room(_config) {

   Thing.call(this, _config);

   var that = this;
}

util.inherits(Room, Thing);

module.exports = exports = Room;
