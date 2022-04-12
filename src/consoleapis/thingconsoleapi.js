var util = require('util');
var SourceConsoleApi = require('./sourceconsoleapi');

function ThingConsoleApi(_config, _owner) {
   SourceConsoleApi.call(this, _config, _owner);
}

util.inherits(ThingConsoleApi, SourceConsoleApi);

// Called when current state required
ThingConsoleApi.prototype.export = function(_exportObj) {
   SourceConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
ThingConsoleApi.prototype.import = function(_importObj) {
   SourceConsoleApi.prototype.import.call(this, _importObj);
};

ThingConsoleApi.prototype.coldStart = function() {
   SourceConsoleApi.prototype.coldStart.call(this);
};

ThingConsoleApi.prototype.hotStart = function() {
   SourceConsoleApi.prototype.hotStart.call(this);
};

ThingConsoleApi.prototype.findMyThingInConfig = function(_thingConfig) {

   if (_thingConfig.name === this.uName) {
      return _thingConfig;
   }

   if (_thingConfig.hasOwnProperty("things") && (_thingConfig.things.length > 0)) {

      for (var i = 0; i < _thingConfig.things.length; ++i) {
         var result = this.findMyThingInConfig(_thingConfig.things[i]);

         if (result) {
            return result;
         }
      }
   }

   return null;
};

ThingConsoleApi.prototype.createThing = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var config = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (this.gang.findNamedObject("::"+config.name)) {
      return _callback("Thing already exists!");
   }

   var topThing = this.myObj().getTopThing();

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(topThing.name, (_err, _topThingConfig) => {

         if (_err || (_topThingConfig === null)) {
            return _callback("Unable to persist new Thing!");
         }

         var myThingInConfig = this.findMyThingInConfig(_topThingConfig);

         if (!myThingInConfig) {
            return _callback("Unable to persist new Thing!");
         }

         if (myThingInConfig.hasOwnProperty("things")) {
            myThingInConfig.things.push(config);
         }
         else {
            myThingInConfig.things = [ config ];
         }

         this.db.update(_topThingConfig, (_err2, _result2) => {

            if (_err2) {
               return _callback("Unable to perist the change");
            }

            var thingObj = this.gang.createThing(config, this.myObj());
            topThing.inheritChildProps();
            this.gang.casa.refreshSourceListeners();
            thingObj.coldStart();
            return _callback(null, true);
         });
      });
   }
   else {
      var thingObj = this.gang.createThing(config);
      topThing.inheritChildProps();
      this.gang.casa.refreshSourceListeners();
      thingObj.coldStart();
      _callback(null, true);
   }
};

ThingConsoleApi.prototype.createProperty = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var config = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (this.myObj().properties.hasOwnProperty(config.name)) {
      return _callback("Property already exists!");
   }

   var topThing = this.myObj().getTopThing();

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(topThing.name, (_err, _topThingConfig) => {

         if (_err || (_topThingConfig === null)) {
            return _callback("Unable to persist new property!");
         }

         var myThingInConfig = this.findMyThingInConfig(_topThingConfig);

         if (!myThingInConfig) {
            return _callback("Unable to persist new property!");
         }

         if (myThingInConfig.hasOwnProperty("properties")) {
            myThingInConfig.properties.push(config);
         }
         else {
            myThingInConfig.properties = [ config ];
         }

         this.db.update(_topThingConfig, (_err2, _result2) => {

            if (_err2) {
               return _callback("Unable to perist the change");
            }

            this.myObj().createProperty(config);
            topThing.inheritChildProps();
            this.gang.casa.refreshSourceListeners();
            this.myObj().properties[config.name].coldStart();
            return _callback(null, true);
         });
      });
   }
   else {
      this.myObj().createProperty(config);
      topThing.inheritChildProps();
      this.gang.casa.refreshSourceListeners();
      this.myObj().properties[config.name].coldStart();
      _callback(null, true);
   }
};

module.exports = exports = ThingConsoleApi;
 
