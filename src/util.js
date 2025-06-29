var Util = require('util');

var _suspensionAvailable = true;

Util.suspensionAvailable = function() {
   return _suspensionAvailable;
};

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

Util.add = function(_collection, _obj, _name) {

   if (typeof _collection === 'object') {
      _collection[_name] = _obj;
   }
   else if (_collection instanceof Array) {
      _collection.push(_obj);
   }
};

Util.filterNames = function(_collection, _func) {
   var dest = [];

   if (typeof _collection === 'object') {

      for (var element in _collection) {

         if (_collection.hasOwnProperty(element) && _func(element)) {
            dest.push(element);
         }
      }
   }

   return dest;
};

Util.filter = function(_collection, _func) {

   if (typeof _collection === 'object') {
      var dest = {};

      for (var element in _collection) {

         if (_collection.hasOwnProperty(element) && _func(element, _collection[element])) {
            dest[element] = _collection[element];
         }
      }

      return dest;
   }
   else if (_collection instanceof Array) {
      var dest = [];

      for (var i = 0; i < _collection.length; ++i) {

         if (_func(_collection[i])) {
            dest.push(_collection[i]);
         }
      }

      return dest;
   }

   return null;
};

Util.iterate = function(_collection, _startIndex, _func) {
   var startIndex = (_startIndex == undefined) ? 0 : _startIndex;

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

// Supports object, array of objects and deep objects of objects and arrays of objects
Util.copyMatch = function(_source, _matchFunc) {

   if (!_source) {
      return null;
   }

   var dest;

   if (_source instanceof Array) {
      dest = [];

      for (var i = 0; i < _source.length; ++i) {
         dest.push(this.copyMatch(_source[i], _matchFunc));
      }
   }
   else if (typeof _source === 'object') {
      dest = {};

      for (var prop in _source) {

         var matchResult = _matchFunc(_source, prop);

         if (typeof matchResult === 'object') {

            if (matchResult.hasOwnProperty("replace")) {
               dest[prop] = matchResult.replace;
            }
         }
         else if (matchResult) {

            if (_source[prop] instanceof Array) {
               dest[prop] = this.copyMatch(_source[prop], _matchFunc);
            }
            else if (typeof _source[prop] === 'object') {
               dest[prop] = this.copyMatch(_source[prop], _matchFunc);
            }
            else {
               dest[prop] = _source[prop];
            }
         }
      }
   }

   return dest;
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
      console.log(_level +  " " +_source.name);

      if ((_level > 0) && (_source.hasOwnProperty('_id') || (_source.hasOwnProperty('config') && _source.config.hasOwnProperty('_id')))) {
         return '{ name:' + _source.name + '}'
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

Util.exists = function(_obj, _member_s) {

   if (!_obj) {
      return false;
   }

   if (_member_s instanceof Array) { 

      for (let i = 0; i < _member_s.length; ++i) {

         if (!_obj.hasOwnProperty(_member_s[i])) {
            return false;
         }
      }
      return true;
   }
   else {
      return _obj.hasOwnProperty(_member_s);
   }
};


Util.checkPath = function(_path) {
   return (_path) ? (((_path.charAt(0) !== '.') && (_path.charAt(0) !== '/')) ? "./" + _path : _path) : _path;
};

Util.stringForType = function(_value) {

   if (typeof _value === 'string' || _value instanceof String) {
      return "\""+_value+"\"";
   }
   else if (_value === false) {
      return "false";
   }
   else if (_value === true) {
      return "true";
   }
   else if (!isNaN(_value) && !isNaN(parseFloat(_value))) {
      return parseFloat(_value).toString();
   }
   else {
      return "\""+_value.toString()+"\"";
   }
};

Util.restoreTimeout = function(_func, _expiration, _minLength) {

   if (_expiration === -1) {
      return null;
   }

   var timeLeft = _expiration - Date.now();

   if (_minLength && (timeLeft < _minLength)) {
      timeLeft = _minLength;
   }

   if (timeLeft <= 0) {
      return null;
   }

   var timer = new Timer();
   let args = [...arguments];
   args[1] = timeLeft;

   if (args.length > 2) {
      args.splice(2, 1);
   }

   Timer.prototype.setTimeout.apply(timer, args);
   return timer;
};

Util.setTimeout = function() {
   var timer = new Timer();
   Timer.prototype.setTimeout.apply(timer, arguments);
   return timer;
};

Util.clearTimeout = function(_timer) {
   _timer.clearTimeout();
};

function Timer() {
   this.timeout = null;
}

Timer.prototype.setTimeout = function(_callback, _duration) {

   if (this.active()) {
      this.clearTimeout();
   }

   this.startTime = Date.now();
   this.duration = _duration;
   this.callback = _callback;

   let args = [...arguments];
   args[0] = Timer.prototype.callbackFunc.bind(this);

   this.timeout = setTimeout.apply(null, args);
};

Timer.prototype.clearTimeout = function() {
   clearTimeout(this.timeout);
   this.timeout = null;
};

Timer.prototype.callbackFunc = function() {

   // Do not attempt a suspension/restore cycle if in casa code and exception raised
   _suspensionAvailable = false;
   this.timeout = null;
   this.callback.apply(this, arguments);
   _suspensionAvailable = true;
}

Timer.prototype.active = function() {
   return this.timeout ? (Date.now() - this.startTime) < this.duration : false;
};

// Returns milliseconds left on the active timer
// -1 if not active
Timer.prototype.left = function() {
   return this.active() ? this.duration - (Date.now() - this.startTime) : -1;
};

// Returns Date.now() for when the active timer will expire
// -1 if not active
Timer.prototype.expiration = function() {
   return this.active() ? this.duration + this.startTime : -1;
};

Util.compare = function(_x, _y) {
   let xkeys = Object.keys(_x).sort((a,b) => a > b ? 1 :(a === b ? 0 : -1));
   let ykeys = Object.keys(_y).sort((a,b) => a > b ? 1 :(a === b ? 0 : -1));
  
   if (xkeys.length !==  ykeys.length) {
     return false;
   }

   for( let i=0; i< xkeys.length; i++) {

      if (xkeys[i] !== ykeys[i]) {
         return false;
      }

      if (typeof xkeys[i] !== typeof ykeys[i]) {
        return false;
      }

      if (typeof _x[xkeys[i]] == 'object' && typeof _x[xkeys[i]] =='object' ) {
         ++i;
         return compareObjects(_x[xkeys[i-1]], _y[ykeys[i-1]])
      }  

      if (_x[xkeys[i]] !== _y[ykeys[i]]) {
         return false;
      }
   }
   return true;
}

module.exports = exports = Util;
