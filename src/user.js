var util = require('util');
var Source = require('./source');
var events = require('events');

function User(_config) {
   this.name = _config.name;
   Source.call(this, _config);

   if (this.casa) {
      console.log('User casa: ' + this.casa.name);
      this.casa.addUser(this);
   }

   var that = this;
};

util.inherits(User, Source);

module.exports = exports = User;
