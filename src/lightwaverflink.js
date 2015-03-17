var util = require('util');
var Thing = require('./thing');

function LightwaveRfLink(_config) {

   Thing.call(this, _config);

   var that = this;
}

util.inherits(LightwaveRfLink, Thing);

module.exports = exports = LightwaveRfLink;
