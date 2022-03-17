var Gang = require('./gang');
var util = require('util');
var NamedObject = require('./namedobject');
 
function ConsoleApi(_config, _owner) {
   this.type = "consoleapi";
   NamedObject.call(this, _config, _owner);
   this.sessions = {};

   this.gang = Gang.mainInstance();

   //process.stdout.write("AAAAA ConsoleAPI() My uName is "+this.uName + "\n");
   //process.stdout.write("AAAAA ConsoleAPI() My object uName is "+this.myObjuName + "\n");

   this.consoleApiService =  this.gang.casa.findService("consoleapiservice");
   this.db = this.gang.getDb();
}

util.inherits(ConsoleApi, NamedObject);

// Used to classify the type and understand where to load the javascript module
ConsoleApi.prototype.superType = function(_type) {
   return "consoleapi";
};

ConsoleApi.prototype.coldStart = function() {
};

ConsoleApi.prototype.getCasa = function() {
   var myObj = this.myObj();
   return myObj ? myObj.getCasa() : null;
};

ConsoleApi.prototype.getSessionObj = function(_session) {

   if (!this.sessions.hasOwnProperty(_session.name)) {
      this.sessions[_session.name] = {};
   }
   return this.sessions[_session.name];
};

ConsoleApi.prototype.sessionClosed = function(_session) {
   delete this.sessions[_session.name];
};

ConsoleApi.prototype.checkParams = function(_minLength, _params) {

   if ((_minLength > 0) && (!_params || (_params.length < _minLength)))  {
      throw("Not enough parameters");
   }
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

ConsoleApi.prototype.ls = function(_session, _params, _callback) {
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

ConsoleApi.prototype.cat = function(_session, _params, _callback) {
   _callback(null, {});
};

module.exports = exports = ConsoleApi;
