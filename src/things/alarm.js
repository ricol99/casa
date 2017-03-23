var util = require('util');
var Thing = require('../thing');

function Alarm(_config) {

   Thing.call(this, _config);

   var that = this;

   this.ensurePropertyExists('line-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('ac-power-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('battery-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('medical-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('panic-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('duress-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('attack-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('carbon-monoxide-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('armed-normal', 'property', { initialValue: false });
   this.ensurePropertyExists('part-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('fully-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('zone-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('in-exit-entry', 'property', { initialValue: false });
   this.ensurePropertyExists('system-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('engineer-mode', 'property', { initialValue: false });
   this.ensurePropertyExists('alarm-error', 'property', { initialValue: '' });
}

util.inherits(Alarm, Thing);

module.exports = exports = Alarm;
