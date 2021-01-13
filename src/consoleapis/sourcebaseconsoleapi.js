var util = require('util');
var ConsoleApi = require('../consoleapi');
var SourceListener = require('../sourcelistener');
var dateFormat = require ('dateFormat');

function SourceBaseConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.sourceListeners = {};
}

util.inherits(SourceBaseConsoleApi, ConsoleApi);

SourceBaseConsoleApi.prototype.cat = function(_session, _params, _callback) {
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
      this.sourceListeners[_name] = { refCount: 1, sourceListener: new SourceListener({ uName: this.uName, property: _name }, this) };
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

SourceBaseConsoleApi.prototype.getWatchList = function(_session) {
   var sessionObj = this.getSessionObj(_session);

   if (!sessionObj.hasOwnProperty("watchList")) {
      sessionObj.watchList = {};
   }
   return sessionObj.watchList;
};

SourceBaseConsoleApi.prototype.watching = function(_session, _params, _callback) {
   var output = [];
   var watchList = this.getWatchList(_session);

   for (var prop in watchList) {

      if (watchList.hasOwnProperty(prop)) {
         output.push(prop);
      }
   }
   return _callback(null, output);
};

SourceBaseConsoleApi.prototype.watch = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var watchList = this.getWatchList(_session);

   if (watchList.hasOwnProperty(_params[0])) {
      return _callback("Already watching \""+_params[0]+"\"");
   }
   else if (this.myObj() && this.myObj().props.hasOwnProperty(_params[0])) {
      watchList[_params[0]] = this.findOrCreateSourceListener(_params[0]);
      return _callback(null, "Watching \""+_params[0]+"\"");
   }
   else {
      return _callback(null, "Property not found!");
   }
};

SourceBaseConsoleApi.prototype.unwatch = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var watchList = this.getWatchList(_session);

   if (!watchList.hasOwnProperty(_params[0])) {
      return _callback("Not currently watching \""+_params[0]+"\"");
   }
   else {
      this.removeListener(_params[0]);
      delete watchList[_params[0]];
      return _callback(null, "Finished watching \""+_params[0]+"\"");
   }
};

SourceBaseConsoleApi.prototype.listeners = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var listeners = this.gang.casa.findListeners(this.uName);
   var listenerUnames = [];

   for (var i=0; i < listeners.length; ++i) {
      if ((listeners[i].owner.type !== "consoleapi") && ((_params[0] == undefined) || (_params[0] === listeners[i].eventName))) {
         listenerUnames.push(listeners[i].owner.uName);
      }
   }

   return _callback(null, listenerUnames);
};

SourceBaseConsoleApi.prototype.sessionClosed = function(_session) {
   var watchList = this.getSessionObj(_session).watchList;

   if (watchList) {

      for (var name in watchList) {
         this.unwatch(name);
      }
   }

   ConsoleApi.prototype.sessionClosed.call(this, _session);
};

SourceBaseConsoleApi.prototype.sourceIsValid = function(_sourceEventName, _sourceName, _eventName) {
};

SourceBaseConsoleApi.prototype.sourceIsInvalid = function(_data) {
};

SourceBaseConsoleApi.prototype.receivedEventFromSource = function(_data) {

   for (var session in this.sessions) {

       if (this.sessions.hasOwnProperty(session)) {

          if (this.sessions[session].hasOwnProperty("watchList")) {

             if (this.sessions[session].watchList.hasOwnProperty(_data.name)) {
                this.consoleApiService.writeOutput(session, dateFormat() + ": Watched property " + this.uName +":"+_data.name+" changed to "+_data.value);
             }
          }
       }
   }
};

module.exports = exports = SourceBaseConsoleApi;
 
