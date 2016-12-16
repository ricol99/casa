var util = require('util');
var Thing = require('./thing');

function Room(_config) {

   Thing.call(this, _config);

   this.setMaxListeners(20);
   this.thingType = "room";
}

util.inherits(Room, Thing);

module.exports = exports = Room;
