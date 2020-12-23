var util = require('util');
var NamedObject = require('./namedobject');

function ConsoleCmd(_config, _console) {
   this.myObjuName = _config.objuName;
   this.gang = Gang.mainInstance();
   this.uName = _console.uName + ":" + this.gang.name + this.myObjuName.substring(1);

   //process.stdout.write("AAAAA ConsoleCmd() My uName is "+this.uName + "\n");
   //process.stdout.write("AAAAA ConsoleCmd() My object uName is "+this.myObjuName + "\n");

   this.myObjName = _config.name;
   this.console = _console;
   this.casa = this.console.getCasa(this.myObjName);
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
   var proto = Object.getPrototypeOf(this);
   var consoleCmdProto = proto;
   var fullScope = (_fullScopeName) ? _fullScopeName + "." : "";

   while (consoleCmdProto.constructor.name !== 'ConsoleCmd') {
      consoleCmdProto = Object.getPrototypeOf(consoleCmdProto);
   }

   var members = _previousMatches ? _previousMatches : [];
   var excObj = {};

   //process.stdout.write("AAAAA proto of obj = "+util.inspect(proto)+"\n");
   //process.stdout.write("AAAAA proto of ConsoleCmd = "+util.inspect(consoleCmdProto)+"\n");

   for (var method in proto) {

      if (proto.hasOwnProperty(method)) {
         //process.stdout.write("AAAAA method name = "+method+"\n");

         if (!consoleCmdProto.hasOwnProperty(method) && !method.startsWith("_")) {
            members.push(fullScope+method);
            //process.stdout.write("AAAAA method "+method+" Added\n");
         }
      }
   }

   members.push(fullScope+"ls");
   members.push(fullScope+"cat");

   this.filterArray(members, fullScope+_filter);
   return members;
};

module.exports = exports = ConsoleCmd;
