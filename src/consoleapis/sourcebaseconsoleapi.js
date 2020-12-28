var util = require('util');
var ConsoleApi = require('../consoleapi');
var SourceListener = require('../sourcelistener');

function SourceBaseConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.sourceListeners = {};
}

util.inherits(SourceBaseConsoleApi, ConsoleApi);

SourceBaseConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult, _perfectMatchRequired) {
   ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().props, _prevResult, _perfectMatchRequired);
};

SourceBaseConsoleApi.prototype.cat = function(_params, _callback) {
   var output = [];

   for (var prop in this.myObj().props) {

      if (this.myObj().props.hasOwnProperty(prop)) {
         output.push(this.myObj().props[prop].name+"="+this.myObj().props[prop].getValue());
      }
   }

   _callback(null, output);
};

SourceBaseConsoleApi.prototype.findOrCreateSourceListener = function(_name) {

   if (!this.sourceListeners.hasOwnProperty(_name)) {
      this.sourceListeners[_name] = { refCount: 1, sourceListener: new SourceListener({ name: this.uName, property: _name }, this) };
      this.sourceListeners[_name].sourceListener.establishListeners();
   }
   else {
      this.sourceListeners[_name].refCount = this.sourceListeners[_name].refCount + 1;
   }

   return this.sourceListeners[_name].sourceListener;
};

SourceBaseConsoleApi.prototype.removeListener = function(_name) {

   if (this.sourceListeners.hasOwnProperty(_name)) {
      this.sourceListeners[_name].refCount = this.sourceListeners[_name].refCount - 1;

      if (this.sourceListeners[_name].refCount === 0) {
         this.sourceListeners[_name].sourceListener.stopListening();
         delete this.sourceListeners[_name].sourceListener;
         delete this.sourceListeners[_name];
      }
   }
};

SourceBaseConsoleApi.prototype.getWatchList = function() {
   var watchList = this.owner.getSessionVar("watchList", this);

   if (!watchList) {
      watchList = {};
      this.owner.addSessionVar("watchList", watchList, this);
   }

   return watchList;
};

SourceBaseConsoleApi.prototype.watching = function(_params, _callback) {
   var output = [];
   var watchList = this.getWatchList();

   for (var prop in watchList) {

      if (watchList.hasOwnProperty(prop)) {
         output.push(prop);
      }
   }

   return _callback(null, output);
};

SourceBaseConsoleApi.prototype.watch = function(_params, _callback) {
   this.checkParams(1, _params);

   var watchList = this.getWatchList();

   if (watchList.hasOwnProperty(_params[0])) {
      return _callback("Already watching \""+_params[0]+"\"");
   }
   else if (this.myObj().props.hasOwnProperty(_params[0])) {
      watchList[_params[0]] = this.findOrCreateSourceListener(_params[0]);
      return _callback(null, "Watching \""+_params[0]+"\"");
   }
   else {
      return _callback(null, "Property not found!");
   }
};

SourceBaseConsoleApi.prototype.unwatch = function(_params, _callback) {
   this.checkParams(1, _params);

   var watchList = this.getWatchList();

   if (!watchList.hasOwnProperty(_params[0])) {
      return _callback("Not currently watching \""+_params[0]+"\"");
   }
   else {
      this.removeListener(_params[0]);
      delete watchList[_params[0]];
      return _callback(null, "Finished watching \""+_params[0]+"\"");
   }
};

SourceBaseConsoleApi.prototype.listeners = function(_params, _callback) {
   this.checkParams(1, _params);

   var listeners = this.gang.casa.findListeners(this.uName);
   var listenerUnames = [];

   for (var i=0; i < listeners.length; ++i) {
      // XXXXX wrong use of owner, need to fix!
      if ((listeners[i].owner.type !== "consoleapi") && ((_params[0] == undefined) || (_params[0] === listeners[i].eventName))) {
         listenerUnames.push(listeners[i].owner.name);
      }
   }

   return _callback(null, listenerUnames);
};

SourceBaseConsoleApi.prototype.sessionClosed = function(_consoleApiObjVars, _sessionId) {
   var watchList = _consoleApiObjVars.watchList;

   if (watchList) {

      for (var name in watchList) {
         this.unwatch(name);
      }
   }
};

SourceBaseConsoleApi.prototype.sourceIsValid = function(_sourceEventName, _sourceName, _eventName) {
};

SourceBaseConsoleApi.prototype.sourceIsInvalid = function(_data) {
};

SourceBaseConsoleApi.prototype.receivedEventFromSource = function(_data) {
   var allSessionVars = this.owner.getAllSessionsForConsoleApiObject(this);

   for (var session in allSessionVars) {

       if (allSessionVars.hasOwnProperty(session)) {

          if (allSessionVars[session].hasOwnProperty("watchList")) {

             if (allSessionVars[session].watchList.hasOwnProperty(_data.name)) {
                this.owner.writeOutput(session, "Watched property " + this.uName +":"+_data.name+" changed to "+_data.value);
             }
          }
       }
   }
};

module.exports = exports = SourceBaseConsoleApi;
 
