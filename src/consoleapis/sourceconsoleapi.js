var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function SourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(SourceConsoleApi, SourceBaseConsoleApi);

SourceConsoleApi.prototype.persistUpdatedSource = function(_member, _newMember, _action, _callback) {
   this.db = this.gang.getDb(this.gang.casa.name);

   this.db.find(this.uName, (_err, _result) => {

      if (_err || (_result === null)) {
         this.db = this.gang.getDb();

         this.db.find(this.uName, (_err2, _result2) => {

            if (_err2 || (_result2 === null)) {
               return _callback(_err2);
            }

            switch (_action) {
            case "replace":
               _result2[_member] = _newMember;
               break;
            case "add":
               if (result2.hasOwnProperty(_member)) {
                  _result2[_member].push(_newMember);
               }
               else {
                  _result2[_member] = _newMember;
               }
               break;
            }
            this.db.update(_result2, _callback);
         });
      }
      else {
         switch (_action) {
         case "replace":
            _result[_member] = _newMember;
            break;
         case "add":
            if (result.hasOwnProperty(_member)) {
               _result[_member].push(_newMember);
            }
            else {
               _result[_member] = _newMember;
            }
            break;
         }

         this.db.update(_result, _callback);
      }
   });
};

SourceConsoleApi.prototype.setProperty = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   _callback(null, this.myObj().setProperty(_params[0], _params[1], {}));
};

SourceConsoleApi.prototype.events = function(_session, _params, _callback) {
   this.checkParams(0, _params);
   _callback(null, this.myObj().events);
};

SourceConsoleApi.prototype.addScheduledEvent = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   var rules = (_params[1] instanceof Array) ? _params[1] : [ _params[1] ];
   var persist = (_params.length > 2) ? _params[2] : false;

   if (!this.myObj().addEvent({ name: _params[0], rules: rules })) {
      return _callback("Event with that name alreadfy exists!");
   }

   if (persist) {
      this.persistUpdatedSource("events", this.myObj().events, "replace", _callback);
   }
   else {
      _callback(null, true);
   }
};

SourceConsoleApi.prototype.removeScheduledEvent = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var persist = (_params.length > 1) ? _params[1] : false;

   var result = this.myObj().deleteEvent(_params[0]);

   if (result && persist) {
      this.persistUpdatedSource("events", this.myObj().events, "replace", _callback);
   }
   else {
      _callback(null, result);
   }
};

SourceConsoleApi.prototype.updateScheduledEvent = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   var rules = (_params[1] instanceof Array) ? _params[1] : [ _params[1] ];
   var persist = (_params.length > 2) ? _params[2] : false;

   var result = this.myObj().updateEvent({ name: _params[0], rules: rules });
   
   if (result && persist) {
      this.persistUpdatedSource("events", this.myObj().events, "replace", _callback);
   }
   else {
      _callback(null, result);
   }
};

SourceConsoleApi.prototype.createProperty = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   var propertyName = _params[0];
   var propertyConfig = _params[1];
   var persist = (_params.length > 2) ? _params[2] : false;

   propertyConfig.name = propertyName;

   var result = this.myObj().createProperty(propertyConfig);

   if (result && persist) {
      this.persistUpdatedSource("properties", propertyConfig, "add", _callback);
   }
   else {
      _callback(null, result);
   }
};

SourceConsoleApi.prototype.raiseEvent = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var eventName = _params[0];
   var eventValue = (_params.length > 1) ? _params[1] : false;

   this.myObj().raiseEvent(eventName, { value: eventValue});
   _callback(null, true);
};

module.exports = exports = SourceConsoleApi;
 
