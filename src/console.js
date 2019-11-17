var Gang = require('./gang');
var util = require('util');

function Console(_config, _owner) {
   this.config = _config;
   this.uName = _config.uName;
   this.consoleObjects = {};
   this.owner = _owner;
   this.fullScopeName = (this.owner && this.owner.fullScopeName !== "") ? this.owner.fullScopeName+":"+this.uName : this.uName

   this.gang = Gang.mainInstance();
   this.consoleService =  this.gang.findService("consoleservice");
}

Console.prototype.coldStart = function() {
};

Console.prototype.filterGlobalObjects = function(_filter) {
   return this.gang.filterGlobalObjects(_filter);
};

Console.prototype.findGlobalObject = function(_uName) {
   return this.gang.findObject(_uName);
};

Console.prototype.filterArray = function(_array, _filter) {

   for (var i = 0; i < _array.length;) {

      if (_array[i].startsWith(_filter)) {
         ++i;
      }
      else {
         _array.splice(i, 1);
      }
   }
};

Console.prototype.getClassHierarchy = function(_obj) {
   var list = [];
   var proto = Object.getPrototypeOf(_obj);

   while (proto) {
       list.push(proto.constructor.name.toLowerCase());
       proto = Object.getPrototypeOf(proto);
   }
   return list;
};

Console.prototype.filterMembers = function(_filterArray, _exclusions) {
   var mainProto = Object.getPrototypeOf(this);
   var proto = mainProto;

   while (proto.constructor.name !== 'Console') {
       proto = Object.getPrototypeOf(proto);
   }

   var members = [];
   var excObj = {};

   if (_exclusions) {

      for (var i = 0; i < _exclusions.length; ++i) {
         excObj[_exclusions[i]] = true;
      }
   }

   for (var method in mainProto) {

      if (!proto.hasOwnProperty(method) && !excObj.hasOwnProperty(method)) {
         members.push(this.fullScopeName+"."+method);
      }
   }

   this.filterArray(members, this.fullScopeName+"."+_filterArray[0]);
   return members;
};

Console.prototype.findOrCreateConsoleObject = function(_uName, _realObj) {
   var segments = _uName.split(":");
   var obj = null;
   var realObj = _realObj;

   if (segments.length < 2) {
      return null;
   }

   if (!this.consoleObjects.hasOwnProperty(_uName)) {

      if (!realObj) {
         realObj = this.findGlobalObject(_uName);

         if (!realObj) {
            return null;
         }
      }
      let classList = this.getClassHierarchy(realObj);

      for (var i = 0; i < classList.length; ++i) {
         var ConsoleObj = this.gang.cleverRequire(segments[0]+"console:"+segments[1], "consoles", classList[i]+"console");

         if (ConsoleObj) {
            break;
         }
      }

      if (!ConsoleObj) {
         return null;
      }

      obj = new ConsoleObj({ uName: _uName }, this);
      this.consoleObjects[_uName] = obj;
   }
   else {
      obj = this.consoleObjects[_uName];
   }

   return obj;
}

// _object - object to search, global search performed if not supplied
// _prevResult  - result object to merge with new results - optional
Console.prototype.filterScope = function(_filterArray, _object, _prevResult)  {
   var prevResultCount =  (_prevResult) ? _prevResult.hits.length : 0;
   var result =  (_prevResult) ? _prevResult : { hits: [], consoleObj: null };
   var matchString = (_filterArray.length === 1) ? _filterArray[0] : _filterArray[0]+":"+_filterArray[1];
   var perfectMatch = null;

   if (_object) {

       for (var obj in _object) {

          if (obj.startsWith(matchString)) {
             result.hits.push(this.fullScopeName+":"+obj);

             if (obj === _filterArray[0]) {
                perfectMatch = obj;
             }
          }
       }
   }
   else {
      result.hits = this.filterGlobalObjects(matchString);
   }

   if ((result.hits.length === 1) && (prevResultCount === 0)) {
      var splitRes = result.hits[0].split(":");
      result.consoleObj = this.findOrCreateConsoleObject(splitRes[splitRes.length-2]+":"+splitRes[splitRes.length-1]);

      if (result.consoleObj && _filterArray.length > 2) {
         _filterArray.splice(0, 2);
         result = result.consoleObj.filterScope(_filterArray);
      }
   }
   else if (perfectMatch) {
      var splitRes = result.hits[0].split(":");
      result.consoleObj = this.findOrCreateConsoleObject(this.uName+":"+perfectMatch);

      if (result.consoleObj && _filterArray.length > 2) {
         _filterArray.splice(0, 2);
         result = result.consoleObj.filterScope(_filterArray);
      }
   }

   return result;
};

Console.prototype.myObj = function() {
   return this.gang.findObject(this.uName);
};

Console.prototype.cat = function() {
};

module.exports = exports = Console;
