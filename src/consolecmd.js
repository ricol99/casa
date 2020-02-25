var util = require('util');

function ConsoleCmd(_config, _console) {
   this.config = _config;
   this.type = "consolecmd";
   this.uName = _config.uName.split(":")[0] + "consolecmd:" + _config.uName.split(":")[1];
   this.myObjuName = _config.uName;
   this.console = _console;
   this.gang = Gang.mainInstance();
   this.casa = this.console.getCasa(this.myObjuName);
}

ConsoleCmd.prototype.coldStart = function() {
};

ConsoleCmd.prototype.checkArguments = function(_minLength, _arguments) {

   if ((!_arguments && (_minLength > 0)) || (_arguments && (_arguments.length < _minLength)))  {
      throw("Not enough arguments");
   }
};

ConsoleCmd.prototype.cat = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.executeParsedCommand(_obj, "cat", [], _callback);
};

ConsoleCmd.prototype.ls = function(_obj, _arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.executeParsedCommand(_obj, "ls", [], _callback);
};

ConsoleCmd.prototype.filterArray = function(_array, _filter) {

   for (var i = 0; i < _array.length;) {

      if (_array[i].startsWith(_filter)) {
         ++i;
      }
      else {
         _array.splice(i, 1);
      }
   }
};

ConsoleCmd.prototype.filterMembers = function(_filter, _previousMatches, _fullScopeName) {
   var mainProto = Object.getPrototypeOf(this);
   var proto = mainProto;
   var fullScope = (_fullScopeName) ? _fullScopeName + "." : "";

   while (proto.constructor.name !== 'ConsoleCmd') {
       proto = Object.getPrototypeOf(proto);
   }

   var members = _previousMatches ? _previousMatches : [];
   var excObj = {};

   for (var method in mainProto) {

      if (!proto.hasOwnProperty(method) && !method.startsWith("_")) {
         members.push(fullScope+method);
      }
   }

   members.push(fullScope+"ls");
   members.push(fullScope+"cat");

   this.filterArray(members, fullScope+_filter);
   return members;
};

module.exports = exports = ConsoleCmd;
