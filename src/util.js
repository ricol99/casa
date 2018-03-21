var Util = require('util');

Util.copy = function(_source, _deep) {

   if (_source == undefined) {
      return _source;
   }

   if (_deep) {
      return JSON.parse(JSON.stringify(_source));
   }

   if (_source instanceof Array) {
      var dest = [];

      for (var i = 0; i < _source.length; ++i) {
         dest.push(this.copy(_source[i]), false);	// Not sure this is correct, we need it for copy config
      }
      return dest;
   }
   else if (typeof _source === 'object') {
      var dest = {};

      for (var prop in _source) {
         dest[prop] = _source[prop];
      }
      return dest;
   }
   else {
      return _source;
   }
};

Util.allAssocArrayElementsDo = function(_obj, _func) {

   for (var prop in _obj) {

      if (_obj.hasOwnProperty(prop)){
         if (!_func(_obj[prop])) {
            return false;
         }
      }
   }
   return true;
};

Util.anyAssocArrayElementsDo = function(_obj, _func) {

   for (var prop in _obj) {

      if (_obj.hasOwnProperty(prop)){
         if (_func(_obj[prop])) {
            return true;
         }
      }
   }
   return false;
};

module.exports = exports = Util;
