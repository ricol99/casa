var util = require('util');
var Console = require('../console');
var SourceListener = require('../sourcelistener');

function SourceBaseConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.sourceListeners = {};
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
         result.consoleObj = this.findOrCreateConsoleObject(this.myObjuName+":"+splitRes[splitRes.length-1], this.myObj().props[splitRes[splitRes.length-1]]);
      }
      else if (perfectMatch) {
         result.consoleObj = this.findOrCreateConsoleObject(this.myObjuName+":"+perfectMatch, this.myObj().props[perfectMatch]);
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

SourceBaseConsole.prototype.findOrCreateSourceListener = function(_name) {

   if (!this.sourceListeners.hasOwnProperty(_name)) {
      this.sourceListeners[_name] = new SourceListener({ uName: this.myObjuName, property: _name }, this);
      this.sourceListeners[_name].establishListeners();
   }

   return this.sourceListeners[_name];
};

SourceBaseConsole.prototype.getWatchList = function() {
   var watchList = this.consoleService.getSessionVar(watchList, this);

   if (!watchList) {
      watchList = {};
      this.consoleService.addSessionVar("watchList", watchList, this);
   }

   return watchList;
};

SourceBaseConsole.prototype.watching = function() {
   var output = [];
   var watchList = this.getWatchList();

   for (var prop in watchList) {

      if (watchList.hasOwnProperty(prop)) {
         output.push(prop);
      }
   }

   return output;
};

SourceBaseConsole.prototype.watch = function(_name) {
   var watchList = this.getWatchList();

   if (watchList.hasOwnProperty(_name)) {
      return "Already watching \""+_name+"\"";
   }
   else if (this.myObj().props.hasOwnProperty(_name)) {
      watchList[_name] = this.findOrCreateSourceListener(_name);
      return "Watching \""+_name+"\"";
   }
   else {
      return "Property not found!";
   }
};

SourceBaseConsole.prototype.unwatch = function(_name) {
   var watchList = this.getWatchList();

   if (!watchList.hasOwnProperty(_name)) {
      return "Not currently watching \""+_name+"\"";
   }
   else {
      watchList[_name].stopListening();
      delete watchList[_name];
      return "Finished watching \""+_name+"\"";
   }
};

SourceBaseConsole.prototype.sessionClosed = function(_consoleObjVars, _sessionId) {
   var watchList = consoleObjVars.watchList;

   if (watchList) {

      for (var name in watchList) {

         if (watchList.hasOwnProperty(name)) {
            watchList[_name].stopListening();
            delete watchList[_name];
         }
      }
   }
};

SourceBaseConsole.prototype.sourceIsValid = function(_sourceEventName, _sourceName, _eventName) {
};

SourceBaseConsole.prototype.sourceIsInvalid = function(_data) {
};

SourceBaseConsole.prototype.receivedEventFromSource = function(_data) {
   var allSessionVars = this.consoleService.getAllSessionsForConsoleObject(this);

   for (var session in allSessionVars) {

       if (allSessionVars.hasOwnProperty(session)) {

          if (allSessionVars[session].hasOwnProperty("watchList")) {

             if (allSessionVars[session].watchList.hasOwnProperty(_data.name)) {
                this.consoleService.writeOutput(session, "Watched property " + this.myObjuName +":"+_data.name+" changed to "+_data.value);
             }
          }
       }
   }
};

module.exports = exports = SourceBaseConsole;
 
