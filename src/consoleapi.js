var Gang = require('./gang');
var util = require('util');

function ConsoleApi(_config, _owner) {
   this.config = _config;
   this.type = "consoleapi";
   this.uName = _config.uName.split(":")[0] + "consoleapi:" + _config.uName.split(":")[1];
   this.myObjuName = _config.uName;
   this.consoleApiObjects = {};
   this.owner = _owner;
   this.fullScopeName = (this.owner && this.owner.fullScopeName !== "") ? this.owner.fullScopeName+":"+this.myObjuName : this.myObjuName

   this.gang = Gang.mainInstance();
   this.consoleApiService =  this.gang.casa.findService("consoleapiservice");
   this.db = this.gang.getDb();
}

ConsoleApi.prototype.coldStart = function() {
};

ConsoleApi.prototype.getCurrentSession = function() {
   return this.consoleApiService.getCurrentSession();
};

ConsoleApi.prototype.getSessionVar = function() {
   return this.consoleApiService.getCurrentSession().getSessionVar(_name, this.uName);
};

ConsoleApi.prototype.addSessionVar = function() {
   return this.consoleApiService.getCurrentSession().addSessionVar(_name, _variable, this.uName);
};

ConsoleApi.prototype.filterGlobalObjects = function(_filter) {
   return this.gang.filterGlobalObjects(_filter);
};

ConsoleApi.prototype.findGlobalObject = function(_uName) {
   return this.gang.findObject(_uName);
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

ConsoleApi.prototype.getClassHierarchy = function(_obj) {
   var list = [];
   var proto = Object.getPrototypeOf(_obj);

   while (proto) {
       list.push(proto.constructor.name.toLowerCase());
       proto = Object.getPrototypeOf(proto);
   }
   return list;
};

ConsoleApi.prototype.filterMembers = function(_filterArray, _exclusions, _previousMatches, _fullScopeName) {
   var mainProto = Object.getPrototypeOf(this);
   var proto = mainProto;
   var fullScopeName = (_fullScopeName) ? _fullScopeName : this.fullScopeName;

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

      if (!proto.hasOwnProperty(method) && !excObj.hasOwnProperty(method)) {
         members.push(fullScopeName+"."+method);
      }
   }

   this.filterArray(members, fullScopeName+"."+_filterArray);
   return members;
};

ConsoleApi.prototype.findOrCreateConsoleApiObject = function(_uName, _realObj) {
   var segments = _uName.split(":");
   var obj = null;
   var realObj = _realObj;

   if (segments.length < 2) {
      return null;
   }

   if (!this.consoleApiObjects.hasOwnProperty(_uName)) {

      if (!realObj) {
         realObj = this.findGlobalObject(_uName);

         if (!realObj) {
            return null;
         }
      }
      let classList = this.getClassHierarchy(realObj);

      for (var i = 0; i < classList.length; ++i) {
         var ConsoleApiObj = this.gang.cleverRequire(segments[0]+"consoleapi:"+segments[1], "consoleapis", classList[i]+"consoleapi");

         if (ConsoleApiObj) {
            break;
         }
      }

      if (!ConsoleApiObj) {
         return null;
      }

      obj = new ConsoleApiObj({ uName: _uName }, this);
      this.consoleApiObjects[_uName] = obj;
   }
   else {
      obj = this.consoleApiObjects[_uName];
   }

   return obj;
}

// _collection object to search, global search performed if not supplied
// _prevResult  - result object to merge with new results - optional
ConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult)  {
   var filterArray = _scope.split(":");
   var prevResultCount =  (_prevResult) ? _prevResult.hits.length : 0;
   var result =  (_prevResult) ? _prevResult : { hits: [], consoleApiObj: null };
   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];

   if (_collection) {

       for (var obj in _collection) {

          if (obj.startsWith(matchString)) {
             result.hits.push((this.fullScopeName === "") ? obj : this.fullScopeName+":"+obj);
          }
       }
   }
   else {
      result.hits = result.hits.concat(this.filterGlobalObjects(matchString))
   }

   if ((result.hits.length === 1) && (prevResultCount === 0)) {
      var splitRes = result.hits[0].split(":");

      if ((filterArray.length === 1) && _collection) {
         result.consoleApiObj = this.findOrCreateConsoleApiObject(this.myObjuName+":"+splitRes[splitRes.length-1], _collection[splitRes[splitRes.length-1]]);
      }
      else {
         result.consoleApiObj = this.findOrCreateConsoleApiObject(splitRes[splitRes.length-2]+":"+splitRes[splitRes.length-1]);
      }

      if (result.consoleApiObj && filterArray.length > 2) {
         filterArray.splice(0, 2);
         result = result.consoleApiObj.filterScope(filterArray.join(":"));
      }
   }

   return result;
};

ConsoleApi.prototype.myObj = function() {
   return this.gang.findObject(this.myObjuName);
};

ConsoleApi.prototype.cat = function() {
};

ConsoleApi.prototype.sessionClosed = function(_consoleApiObjVars, _sessionId) {
};

module.exports = exports = ConsoleApi;
