var util = require('util');
var Console = require('../console');
var SourceListener = require('../sourcelistener');

function SourceBaseConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.watchList = {};
}

util.inherits(SourceBaseConsole, Console);

SourceBaseConsole.prototype.filterScope = function(_filterArray) {
   var result = { hits: [], consoleObj: null };
   var perfectMatch = null;

   if (_filterArray.length === 1) {

      for (var prop in this.myObj().props) {

         if (prop.startsWith(_filterArray[0])) {
            result.hits.push(this.fullScopeName+":"+prop);

            if (prop === _filterArray[0]) {
               perfectMatch = prop;
            }
         }
      }

      if (result.hits.length === 1) {
         var splitRes = result.hits[0].split(":");
         result.consoleObj = this.findOrCreateConsoleObject(this.uName+":"+splitRes[splitRes.length-1], this.myObj().props[splitRes[splitRes.length-1]]);
      }
      else if (perfectMatch) {
         result.consoleObj = this.findOrCreateConsoleObject(this.uName+":"+perfectMatch, this.myObj().props[perfectMatch]);
      }
   }

   return result;
};

SourceBaseConsole.prototype.filterMembers = function(_filterArray) {
   return Console.prototype.filterMembers.call(this, _filterArray, ["sourceIsValid", "sourceIsInvalid", "receivedEventFromSource"]);
};

SourceBaseConsole.prototype.cat = function() {
   var output = [];

   for (var prop in this.myObj().props) {

      if (this.myObj().props.hasOwnProperty(prop)) {
         output.push(this.myObj().props[prop].name+"="+this.myObj().props[prop].getValue());
      }
   }

   return output;
};

SourceBaseConsole.prototype.prop = function(_name) {
   return this.myObj().props[_name].getValue();
};

SourceBaseConsole.prototype.props = function() {
   return this.myObj().props;
};

SourceBaseConsole.prototype.watching = function() {
   var output = [];

   for (var prop in this.watchList) {

      if (this.watchList.hasOwnProperty(prop)) {
         output.push(prop);
      }
   }
   return output;
};

SourceBaseConsole.prototype.watch = function(_name) {

   if (this.watchList.hasOwnProperty(_name)) {
      return "Already watching \""+_name+"\"";
   }
   else if (this.myObj().props.hasOwnProperty(_name)) {
      this.watchList[_name] = new SourceListener({ uName: this.uName, property: _name }, this);
      this.watchList[_name].establishListeners();
      return "Watching \""+_name+"\"";
   }
   else {
      return "Property not found!";
   }
};

SourceBaseConsole.prototype.unwatch = function(_name) {

   if (!this.watchList.hasOwnProperty(_name)) {
      return "Not currently watching \""+_name+"\"";
   }
   else {
      this.watchList[_name].stopListening();
      delete this.watchList[_name];
      return "Finished watching \""+_name+"\"";
   }
};

SourceBaseConsole.prototype.sourceIsValid = function(_sourceEventName, _sourceName, _eventName) {
};

SourceBaseConsole.prototype.sourceIsInvalid = function(_data) {
};

SourceBaseConsole.prototype.receivedEventFromSource = function(_data) {
};

module.exports = exports = SourceBaseConsole;
 
