var Gang = require('./gang');
var util = require('util');
var NamedObject = require('./namedobject');
 
function ConsoleApi(_config, _owner) {
   this.config = _config;
   this.type = "consoleapi";
   NamedObject.call(this, _config, _owner);

   this.gang = Gang.mainInstance();

   //process.stdout.write("AAAAA ConsoleAPI() My uName is "+this.uName + "\n");
   //process.stdout.write("AAAAA ConsoleAPI() My object uName is "+this.myObjuName + "\n");

   this.consoleApiService =  this.gang.casa.findService("consoleapiservice");
   this.db = this.gang.getDb();
}

util.inherits(ConsoleApi, NamedObject);

ConsoleApi.prototype.coldStart = function() {
};

ConsoleApi.prototype.getCasa = function() {
   var myObj = this.myObj();
   return myObj ? myObj.getCasa() : null;
};

ConsoleApi.prototype.checkParams = function(_minLength, _params) {

   if (_params.length < _minLength)  {
      throw("Not enough parameters");
   }
};

ConsoleApi.prototype.getCurrentSession = function() {
   return this.consoleApiService.getCurrentSession();
};

ConsoleApi.prototype.getSessionVar = function() {
   return this.consoleApiService.getCurrentSession().getSessionVar(_name, this.name);
};

ConsoleApi.prototype.addSessionVar = function() {
   return this.consoleApiService.getCurrentSession().addSessionVar(_name, _variable, this.name);
};

ConsoleApi.prototype.filterArray = function(_array, _filter) {

   for (var i = 0; i < _array.length;) {

      if (_array[i].startsWith(_filter)) {
         ++i;
      }
      else {
         _array.splice(i, 1);
      }
   }
};

ConsoleApi.prototype.myObj = function() {
   return this.gang.findNamedObject(this.uName);
};

ConsoleApi.prototype.ls = function(_params, _callback) {
   this.checkParams(0, _params);

   var obj = this.gang.findNamedObject(this.uName);

   if (!obj) {
      _callback("Object not found!");
      return;
   }

   var results = [];

   for (var namedObject in obj.myNamedObjects) {

      if (obj.myNamedObjects.hasOwnProperty(namedObject)) {
         results.push(obj.myNamedObjects[namedObject].name + ":");
      }
   }

   _callback(null, results);
};

ConsoleApi.prototype.cat = function(_params, _callback) {
   _callback(null, {});
};

ConsoleApi.prototype.sessionClosed = function(_consoleApiObjVars, _sessionId) {
};

module.exports = exports = ConsoleApi;
