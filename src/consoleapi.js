var Gang = require('./gang');
var util = require('util');

function ConsoleApi(_config, _owner) {
   this.owner = _owner;
   this.myObjuName = _config.objuName;
   this.gang = Gang.mainInstance();
   this.uName = _owner.uName + ":" + this.gang.name + this.myObjuName.substring(1);

   //process.stdout.write("AAAAA ConsoleAPI() My uName is "+this.uName + "\n");
   //process.stdout.write("AAAAA ConsoleAPI() My object uName is "+this.myObjuName + "\n");

   this.db = this.gang.getDb();
}

ConsoleApi.prototype.getCasa = function() {
   return this.gang.casa;
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

ConsoleApi.prototype.filterMembers = function(_filterArray, _exclusions, _previousMatches) {
   var mainProto = Object.getPrototypeOf(this);
   var proto = mainProto;

   while (proto.constructor.name !== 'ConsoleApi') {
       proto = Object.getPrototypeOf(proto);
   }

   var members = _previousMatches ? _previousMatches : [];
   var excObj = {};

   if (_exclusions) {

      for (var i = 0; i < _exclusions.length; ++i) {
         excObj[_exclusions[i]] = true;
      }
   }

   for (var method in mainProto) {

      if (mainProto.hasOwnProperty(method)) {

         if (!proto.hasOwnProperty(method) && !excObj.hasOwnProperty(method)) {
            members.push(this.myObjuName+"."+method);
         }
      }
   }

   members.push(this.myObjuName+"."+"ls");
   members.push(this.myObjuName+"."+"cat");

   this.filterArray(members, this.myObjuName+"."+_filterArray);
   return members;
};

ConsoleApi.prototype.myObj = function() {
   return this.gang.findNamedObject(this.myObjuName);
};

ConsoleApi.prototype.ls = function(_params, _callback) {
   this.checkParams(0, _params);

   var obj = this.gang.findNamedObject(this.myObjuName);

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
