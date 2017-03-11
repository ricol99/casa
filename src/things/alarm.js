var util = require('util');
var Thing = require('../thing');

function Alarm(_config) {

   Thing.call(this, _config);

   var that = this;
}

util.inherits(Alarm, Thing);

module.exports = exports = Alarm;
