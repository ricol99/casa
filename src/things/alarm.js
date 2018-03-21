var util = require('util');
var Thing = require('../thing');

function Alarm(_config) {

   Thing.call(this, _config);
   this.thingType = "alarm";

   this.schedules = _config.schedules;

}

util.inherits(Alarm, Thing);

module.exports = exports = Alarm;
