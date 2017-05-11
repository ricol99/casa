var util = require('util');
var Thing = require('../thing');

function Alarm(_config) {

   Thing.call(this, _config);

   var that = this;

   this.ensurePropertyExists('line-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('ac-power-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('battery-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('medical-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('panic-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('duress-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('attack-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('carbon-monoxide-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('armed-normal', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('part-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('fully-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('zone-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('in-exit-entry', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('system-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('engineer-mode', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('alarm-error', 'property', { initialValue: '' }, _config);
}

util.inherits(Alarm, Thing);

module.exports = exports = Alarm;
