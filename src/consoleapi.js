var Gang = require('./gang');
var util = require('util');
var NamedObject = require('./namedobject');
 
function ConsoleApi(_config, _owner) {
   _config.transient = true;
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

// Called when current state required
ConsoleApi.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
};

// Called when current state required
ConsoleApi.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
};

ConsoleApi.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
};

ConsoleApi.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
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

ConsoleApi.prototype.tree = function(_session, _params, _callback) {
   this.checkParams(0, _params);

   let objName = (_params && _params.length > 0) ? _params[0] : this.uName;
   var obj = (objName === ":") ? this.gang : this.gang.findNamedObject(objName);

   if (!obj) {
      _callback("Object not found!");
      return;
   }

   var exportObj = {};
   obj.export(exportObj);

   _callback(null, exportObj);
};

module.exports = exports = ConsoleApi;
