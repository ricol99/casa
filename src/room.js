var util = require('util');
var Thing = require('./thing');

function Room(_config) {

   Thing.call(this, _config);

   this.thingType = "room";
}

util.inherits(Room, Thing);

module.exports = exports = Room;
