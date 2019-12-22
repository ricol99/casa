var util = require('util');
var ServiceConsoleApi = require('./serviceconsoleapi');

function HueServiceConsoleApi(_config, _owner) {
   ServiceConsoleApi.call(this, _config, _owner);

   this.hue = this.myObj().hue;
}

util.inherits(HueServiceConsoleApi, ServiceConsoleApi);

HueServiceConsoleApi.prototype.lights = function(_params, _callback) {
   var output = "";

   this.hue.lights(function(_err, _result) {

      if (_err) {
         return _callback(_err);
      }

      for (var i = 0; i < _result.lights.length; ++i) {
         output.concat(_result.lights[i].id + "\t" + _result.lights[i].name+"\n");
      }

      _callback(null, output);
   });
};

HueServiceConsoleApi.prototype.groups = function(_params, _callback) {
   var output = "";
   
   this.hue.lightGroups(function(_err, _result) {
      
      if (_err) {
         return _callback(_err);
      }
      
      for (var i = 0; i < _result.length; ++i) {
         output.concat(_result[i].id + "\t" + _result[i].name+"\n");
      }
      
      _callback(null, output);
   });
};

HueServiceConsoleApi.prototype.scenes = function(_params, _callback) {
   var output = "";
   
   this.hue.scenes(function(_err, _result) {
      
      if (_err) {
         return _callback(_err);
      }
      
      for (var i = 0; i < _result.length; ++i) {
         output.concat(_result[i].id + "\t" + _result[i].name+"\n");
      }
      
      _callback(null, output);
   });
};

HueServiceConsoleApi.prototype.createGroup = function(_params, _callback) {
   this.checkParams(2, _params);
   var name = _params[0];
   var lightIds = _params[1];

   this.hue.createGroup(name, lightIds, _callback);
};

HueServiceConsoleApi.prototype.deleteGroup = function(_params, _callback) {
   this.checkParams(1, _params);
   var id = _params[0];

   this.hue.deleteGroup(id, _callback);
};

module.exports = exports = HueServiceConsoleApi;
 
