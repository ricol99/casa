var util = require('util');
var Console = require('../console');
var SourceListener = require('../sourcelistener');

function ThingConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.watchList = {};
}

util.inherits(ThingConsole, Console);

ThingConsole.prototype.filterScope = function(_filterArray) {
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

   return Console.prototype.filterScope.call(this, _filterArray, this.myObj().things, result);
};

ThingConsole.prototype.filterMembers = function(_filterArray) {
   return Console.prototype.filterMembers.call(this, _filterArray, ["sourceIsValid", "sourceIsInvalid", "receivedEventFromSource"]);
};

ThingConsole.prototype.cat = function() {

   for (var prop in this.myObj().props) {

      if (this.myObj().props.hasOwnProperty(prop)) {
         process.stdout.write(this.myObj().props[prop].name+"="+this.myObj().props[prop].getValue()+"\n");
      }
   }
};

ThingConsole.prototype.prop = function(_name) {
   return process.stdout.write(this.myObj().props[_name].getValue()+"\n");
};

ThingConsole.prototype.props = function() {
   return this.myObj().props;
};

ThingConsole.prototype.watching = function() {

   for (var prop in this.watchList) {

      if (this.watchList.hasOwnProperty(prop)) {
         process.stdout.write(prop+"\n");
      }
   }
   return true;
};

ThingConsole.prototype.watch = function(_name) {

   if (this.watchList.hasOwnProperty(_name)) {
      process.stdout.write("-> Already watching \""+_name+"\"\n");
      return true;
   }
   else if (this.myObj().props.hasOwnProperty(_name)) {
      this.watchList[_name] = new SourceListener({ uName: this.uName, property: _name }, this);
      this.watchList[_name].establishListeners();
      process.stdout.write("-> Watching \""+_name+"\"\n");
      return true;
   }
   else {
      process.stdout.write("-> Property not found!\n");
      return false;
   }
};

ThingConsole.prototype.unwatch = function(_name) {

   if (!this.watchList.hasOwnProperty(_name)) {
      process.stdout.write("-> Not currently watching \""+_name+"\"");
      return false;
   }
   else {
      this.watchList[_name].stopListening();
      delete this.watchList[_name];
      process.stdout.write("-> Finished watching \""+_name+"\"\n");
      return true;
   }
};

ThingConsole.prototype.sourceIsValid = function(_sourceEventName, _sourceName, _eventName) {
   process.stderr.write(this.uName+" " + _data.name + " is now valid!\n");
};

ThingConsole.prototype.sourceIsInvalid = function(_data) {
   process.stderr.write(this.uName+" " + _data.name + " has become invalid!\n");
};

ThingConsole.prototype.receivedEventFromSource = function(_data) {
   process.stderr.write(this.uName+" " + _data.name + "=" + _data.value+"\n");
};

module.exports = exports = ThingConsole;
 
