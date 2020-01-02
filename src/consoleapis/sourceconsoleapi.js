var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function SourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(SourceConsoleApi, SourceBaseConsoleApi);

SourceConsoleApi.prototype.filterMembers = function(_filterArray, _exclusions) {
   var myExclusions = [ "persistEvents" ];

   if (_exclusions) {
      return SourceBaseConsoleApi.prototype.filterMembers.call(this, _filterArray, myExclusions.concat(_exclusions));
   }
   else {
      return SourceBaseConsoleApi.prototype.filterMembers.call(this, _filterArray, myExclusions);
   }
};

SourceConsoleApi.prototype.persistEvents = function(_events, _callback) {
   this.db = this.gang.getDb(this.gang.casa.uName);

   this.db.find(this.myObjuName, (_err, _result) => {

      if (_err) {
         this.db = this.gang.getDb();

         this.db.find(this.myObjuName, (_err2, _result2) => {

            if (_err2) {
               return _callback(_err2);
            }

            _result2.events = _events;
            this.db.update(_result2, _callback);
         });
      }
      else {
         _result.events = _events;
         this.db.update(_result, _callback);
      }
   });
};

SourceConsoleApi.prototype.setProperty = function(_params, _callback) {
   this.checkParams(2, _params);
   _callback(null, this.myObj().setProperty(_params[0], _params[1], {}));
};

SourceConsoleApi.prototype.events = function(_params, _callback) {
   this.checkParams(0, _params);
   _callback(null, this.myObj().events);
};

SourceConsoleApi.prototype.addScheduledEvent = function(_params, _callback) {
   this.checkParams(2, _params);
   var rules = (_params[1] instanceof Array) ? _params[1] : [ _params[1] ];
   var persist = (_params.length > 2) ? _params[2] : false;

   this.myObj().addEvent({ name: _params[0], rules: rules });

   if (persist) {
      this.persistEvents(this.myObj().events, _callback);
   }
   else {
      _callback(null, true);
   }
};

SourceConsoleApi.prototype.removeScheduledEvent = function(_params, _callback) {
   this.checkParams(1, _params);
   var persist = (_params.length > 1) ? _params[1] : false;

   var result = this.myObj().deleteEvent(_params[0]);

   if (result && persist) {
      this.persistEvents(this.myObj().events, _callback);
   }
   else {
      _callback(null, result);
   }
};

SourceConsoleApi.prototype.updateScheduledEvent = function(_params, _callback) {
   this.checkParams(2, _params);
   var rules = (_params[1] instanceof Array) ? _params[1] : [ _params[1] ];
   var persist = (_params.length > 2) ? _params[2] : false;

   var result = this.myObj().updateEvent({ name: _params[0], rules: rules });
   
   if (result && persist) {
      this.persistEvents(this.myObj().events, _callback);
   }
   else {
      _callback(null, result);
   }
};

module.exports = exports = SourceConsoleApi;
 
