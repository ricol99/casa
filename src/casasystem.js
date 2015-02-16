var util = require('util');
var Thing = require('./thing');

function CasaSystem(_casaName, _config) {
   this.casaName = _casaName;
   this.config = _config;

   Thing.call(this, 'casa-system:' + _casaName, "Casa System " + _casaName);
   var that = this;




   var cleverRequire = function(_name) {
      var constructors = {};
      var str = S(_name).between('', ':').s;

      if (!constructors[str]) {
         constructorsh[str] = require('./' + str);
      }

      return constructors[str];

   }
}

util.inherits(CasaSystem, Thing);

module.exports = exports = CasaSystem;
