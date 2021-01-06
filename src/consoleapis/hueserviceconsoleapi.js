var util = require('util');
var ServiceConsoleApi = require('./serviceconsoleapi');

function HueServiceConsoleApi(_config, _owner) {
   ServiceConsoleApi.call(this, _config, _owner);

   this.hue = this.myObj().hue;
}

util.inherits(HueServiceConsoleApi, ServiceConsoleApi);

HueServiceConsoleApi.prototype.findBridges = function(_session, _params, _callback) {
   this.checkParams(0, _params);
   this.myObj().findBridges(_callback);
};

HueServiceConsoleApi.prototype.findBridge = function(_session, _params, _callback) {
   this.checkParams(0, _params);

   var linkId = (_params.length > 0) ? _params[0] : this.myObj().linkId;

   this.findBridges([], (_err, _bridges) => {

      if (_err || (_bridges.length === 0)) {
         return  _callback("Unable to find bridge with id " + linkId);
      }

      for (var i = 0; i < _bridges.length; ++i) {

         if (_bridges[i].id === linkId) {
            return _callback(null, _bridges[i]);
         }
      }

      _callback("Unable to find bridge with id " + linkId);
   });
};

HueServiceConsoleApi.prototype.setLinkId = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var linkId = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(this.uName, (_err, _hueServiceConfig) => {

         if (_err || (_hueServiceConfig === null)) {
            return _callback("Unable to persist link id!");
         }

         _hueServiceConfig.linkId = linkId;

         this.db.update(_hueServiceConfig, (_err2, _result) => {

            if (_err2) {
               return _callback("Unable to perist the link id");
            }

            this.myObj().linkId = linkId;
            return _callback(null, true);
         });
      });
   }
   else {
      this.myObj().linkId = linkId;
      _callback(null, true);
   }

};

HueServiceConsoleApi.prototype.createUserOnBridge = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var linkIpAddress = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   this.myObj().createUserOnBridge(linkIpAddress, (_err, _userId) => {

      if (_err) {
         return _callback("Unable to create user id on bridge!");
      }

      if (persist) {
         this.db = this.gang.getDb(this.gang.casa.name);

         this.db.find(this.uName, (_err, _hueServiceConfig) => {

            if (_err || (_hueServiceConfig === null)) {
               return _callback("Unable to persist user id!");
            }

            _hueServiceConfig.userId = _userId;

            this.db.update(_hueServiceConfig, (_err2, _result) => {

               if (_err2) {
                  return _callback("Unable to perist the link id");
               }

               this.myObj().userId = _userId;
               this.myObj().coldStart();
               return _callback(null, true);
            });
         });
      }
      else {
         this.myObj().userId = _userId;
         this.myObj().coldStart();
         _callback(null, _userId);
      }
   });
};

HueServiceConsoleApi.prototype.lights = function(_session, _params, _callback) {
   var output = [];

   this.hue.lights(function(_err, _result) {

      if (_err) {
         return _callback(_err);
      }

      for (var i = 0; i < _result.lights.length; ++i) {
         output.push({ id: _result.lights[i].id, name: _result.lights[i].name });
      }

      _callback(null, output);
   });
};

HueServiceConsoleApi.prototype.groups = function(_session, _params, _callback) {
   var output = [];
   
   this.hue.lightGroups(function(_err, _result) {
      
      if (_err) {
         return _callback(_err);
      }
      
      for (var i = 0; i < _result.length; ++i) {
         output.push({ id: _result[i].id, name: _result[i].name });
      }
      
      _callback(null, output);
   });
};

HueServiceConsoleApi.prototype.scenes = function(_session, _params, _callback) {
   var output = [];
   
   this.hue.scenes(function(_err, _result) {
      
      if (_err) {
         return _callback(_err);
      }
      
      for (var i = 0; i < _result.length; ++i) {
         output.push({ id: _result[i].id, name: _result[i].name });
      }
      
      _callback(null, output);
   });
};

HueServiceConsoleApi.prototype.createGroup = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   var name = _params[0];
   var lightIds = _params[1];

   this.hue.createGroup(name, lightIds, _callback);
};

HueServiceConsoleApi.prototype.deleteGroup = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var id = _params[0];

   this.hue.deleteGroup(id, _callback);
};

module.exports = exports = HueServiceConsoleApi;
 
