var Util = require('util');

Util.memberCount = function(_obj) {
   var count = 0;

   for (var param in _obj) {

      if (_obj.hasOwnProperty(param)) {
         ++count;
      }
   }

   return count;
}

Util.getLocalIpAddress = function() {
   var os = require( 'os' );
   var networkInterfaces = os.networkInterfaces( );

   for (var ni in networkInterfaces) {

      for (var i = 0; i < networkInterfaces[ni].length; ++i) {

         if (!networkInterfaces[ni][i].internal && networkInterfaces[ni][i].family === 'IPv4') {
            return networkInterfaces[ni][i].address;
         }
      }
   }
};

Util.getClassHierarchy = function(_obj) {
   var list = [];
   var proto = Object.getPrototypeOf(_obj);

   while (proto) {
       list.push(proto.constructor.name.toLowerCase());
       proto = Object.getPrototypeOf(proto);
   }
   return list;
};

Util.filter = function(_collection, _func) {
   var dest = [];

   if (typeof _collection === 'object') {

      for (var element in _collection) {

         if (_collection.hasOwnProperty(element) && _func(element)) {
            dest.push(element);
         }
      }
   }
   else if (_collection instanceof Array) {

      for (var i = 0; i < _collection.length; ++i) {

         if (_func(_collection[i])) {
            dest.push(_collection[i]);
         }
      }
   }

   return dest;
};

Util.iterate = function(_collection, _startIndex, _func) {
   var startIndex = (_startIndex == undefined) ? 0 : _startIndex;
   console.log("AAAAA startIndex="+startIndex);

   if (typeof _collection === 'object') {
      var index = 0;

      for (var element in _collection) {

         if (_collection.hasOwnProperty(element) && (index >= startIndex)) {

            if (_func(_collection[element])) {
               break;
            }
         }
         ++index;
      }
   }
   else if (_collection instanceof Array) {

      for (var i = startIndex; i < _collection.length; ++i) {

         if (_func(_collection[i])) {
            break;
         }
      }
   }
};


Util.assign = function(_dest, _source) {

   if (typeof _source === 'object') {

      for (var prop in _source) {
         _dest[prop] = _source[prop];
      }
   }
   else if (_source instanceof Array) {
      _dest.length = 0;

      for (var i = 0; i < _source.length; ++i) {
         _dest.push(this.copy(_source[i]), false);       // Not sure this is correct, we need it for copy config
      }
   }
   else {
      _dest = _source;
   }

}

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

Util.stringify = function(_source) {
   return stringifyInternal(_source, 0);
}

function stringifyInternal(_source, _level) {

   if (!_source) {
      return JSON.stringify(_source);
   }

   if (_source instanceof Array) {
      var output = "[";

      for (var i = 0; i < _source.length; ++i) {

         if ((_source[i] instanceof Array) || (typeof _source[i] === 'object')) {
            output += stringifyInternal(_source[i], _level + 1);
         }
         else {
            output += JSON.stringify(_source[i]);
         }
         output += ",";
      }

      if (_source.length === 0) {
         output += ']';
      }
      else {
         output = output.slice(0, -1) + "]";
      }

      return output;
   }
   else if (typeof _source === 'object') {
      console.log(_level +  " " +_source.uName);

      if ((_level > 0) && (_source.hasOwnProperty('_id') || (_source.hasOwnProperty('config') && _source.config.hasOwnProperty('_id')))) {
         return '{uName:' + _source.uName + '}'
      }
      
      var output = "{", i = 0;

      for (var prop in _source) {

         if (_source.hasOwnProperty(prop)) {
            ++i;
            output += prop + ":";

            if ((_source[prop] instanceof Array) || (typeof _source[prop] === 'object')) {
               output += stringifyInternal(_source[prop], _level + 1);
            }
            else {
               output += JSON.stringify(_source[prop]);
            }
            output += ",";
         }
      }

      if (i === 0) {
         output += '}';
      }
      else {
         output = output.slice(0, -1) + "}";
      }

      return output;
   }
   else {
      return JSON.stringfy(_source);
   }
};

Util.ensureExists = function(_obj, _name, _value) {

   if (_obj && !_obj.hasOwnProperty(_name)) {
      _obj[_name] = _value;
      return true;
   }
   else {
      return false;
   }
};

module.exports = exports = Util;
