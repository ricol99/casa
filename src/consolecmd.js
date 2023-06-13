var util = require('util');
var NamedObject = require('./namedobject');
var Gang = require('./gang');

function ConsoleCmd(_config, _owner, _console) {
   _config.transient = true;
   NamedObject.call(this, _config, _owner);

   this.casaName = _config.hasOwnProperty("casaName") ? _config.casaName : null;
   this.console = _console;
   this.gang = Gang.mainInstance();
   this.casa = this.console.getCasa(this.casaName);
   this.dbService = this.gang.casa.findService("dbservice");

   this.sourceCasa = _config.hasOwnProperty("sourceCasa") ? _config.sourceCasa :  null;
}

util.inherits(ConsoleCmd, NamedObject);

// Used to classify the type and understand where to load the javascript module
ConsoleCmd.prototype.superType = function(_type) {
   return "consolecmd";
};

// Called when current state required
ConsoleCmd.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
};

// Called when current state required
ConsoleCmd.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
};

ConsoleCmd.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
};

ConsoleCmd.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
};

ConsoleCmd.prototype.checkArguments = function(_minLength, _arguments) {

   if ((!_arguments && (_minLength > 0)) || (_arguments && (_arguments.length < _minLength)))  {
      throw("Not enough arguments");
   }
};

ConsoleCmd.prototype.executeParsedCommand = function(_method, _arguments, _callback) {
   this.console.executeParsedCommand(this, _method, _arguments, _callback);
};

ConsoleCmd.prototype.executeParsedCommandOnAllCasas = function(_method, _arguments, _callback) {
   this.console.executeParsedCommandOnAllCasas(this, _method, _arguments, _callback);
};

ConsoleCmd.prototype.casas = function(_arguments, _callback) {
   _callback(null, this.console.getCasas());
};

ConsoleCmd.prototype.cc = function(_arguments, _callback) {
   this.console.setSourceCasa((_arguments && _arguments.length === 1) ? _arguments[0] : null, _callback);
};

ConsoleCmd.prototype.quit = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   process.exit(1);
};

ConsoleCmd.prototype.exit = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   process.exit(1);
};

ConsoleCmd.prototype.cat = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("cat", [], _callback);
};

ConsoleCmd.prototype.ls = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("ls", [], _callback);
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
   var fullScope = (_fullScopeName) ? _fullScopeName + ":" : "";
   //process.stdout.write("AAAAA fullScope= "+fullScope+"\n");

   while (consoleCmdProto.constructor.name !== 'ConsoleCmd') {
      consoleCmdProto = Object.getPrototypeOf(consoleCmdProto);
   }

   var members = _previousMatches ? _previousMatches : [];
   var excObj = {};

   //process.stdout.write("AAAAA proto of obj = "+util.inspect(proto)+"\n");
   //process.stdout.write("AAAAA proto of ConsoleCmd = "+util.inspect(consoleCmdProto)+"\n");

   while (proto.constructor.name !== 'ConsoleCmd') {

      for (var method in proto) {

         if (proto.hasOwnProperty(method)) {
            //process.stdout.write("AAAAA method name = "+method+"\n");

            if (!consoleCmdProto.hasOwnProperty(method) && !method.startsWith("_")) {
               excObj[fullScope+method] = true;
               //members.push(fullScope+method);
               //process.stdout.write("AAAAA method "+fullScope+method+" Added\n");
            }
         }
      }

      proto = Object.getPrototypeOf(proto);
   }

   for (var member in excObj) {

      if (excObj.hasOwnProperty(member)) {
         members.push(member);
      }
   }

   members.push(fullScope+"casas");
   members.push(fullScope+"cc");
   members.push(fullScope+"ls");
   members.push(fullScope+"cat");
   members.push(fullScope+"quit");
   members.push(fullScope+"exit");

   this.filterArray(members, fullScope+_filter);
   return members;
};

module.exports = exports = ConsoleCmd;
