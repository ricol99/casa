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

ConsoleApi.prototype.checkParams = function(_minLength, _params) {

   if (_params.length < _minLength)  {
      throw("Not enough parameters");
   }
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

   members.push(fullScopeName+"."+"ls");
   members.push(fullScopeName+"."+"cat");

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
      let classList = util.getClassHierarchy(realObj);

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
ConsoleApi.prototype.filterScope = function(_scope, _collection, _result, _perfectMatchRequired)  {
   var filterArray = _scope.split(":");
   var prevResultCount =  _result.hasOwnProperty("hits") ? _result.hits.length : 0;
   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];
   var perfectMatch = -1;
   var hits = [];

   if (!_result.hasOwnProperty("hits")) {
      _result.hits = [];
   }

   var matches = _collection ? util.filter(_collection, (_obj) => { return _obj.startsWith(matchString); }) : this.filterGlobalObjects(matchString);

   util.iterate(matches, 0, (_obj) => {

      if (_obj === matchString) {
         perfectMatch = hits.length;
         hits.push((this.fullScopeName === "") ? _obj : this.fullScopeName+":"+_obj);
      }
      else if (!_perfectMatchRequired) {
         hits.push((this.fullScopeName === "") ? _obj : this.fullScopeName+":"+_obj);
      }
   });

   if (perfectMatch !== -1) {
      var consoleApiObj = this.findOrCreateConsoleApiObject(((filterArray.length === 1) ? this.myObjuName+":" : "") + matchString, _collection ? _collection[matchString] : undefined);

      if (consoleApiObj) {
         filterArray.splice(0, (filterArray.length >= 2) ? 2 : 1);

         if (filterArray.length > 0) {
            consoleApiObj.filterScope((filterArray.length === 1) ? filterArray[0] : filterArray.join(":"), undefined, _result, _perfectMatchRequired);

            if (!_result.consoleApiObj && !_perfectMatchRequired) {
               _result.consoleApiObj = consoleApiObj;
               _result.scope = this.fullScopeName;
            }
         }
         else {
            _result.consoleApiObj = consoleApiObj;
            _result.scope = this.fullScopeName;
            _result.remainingStr = "";
            _result.hits.push(...hits);
         }
      }
   }
   else {
      if (!_perfectMatchRequired) {
         _result.hits.push(...hits);
         var remainingStr = (filterArray.length === 0) ? "" : (filterArray.length === 1) ? filterArray[0] : filterArray.join(":");

         if (!_result.hasOwnProperty("remainingStr") || (_result.remainingStr.length > remainingStr.length)) {
            _result.scope = this.fullScopeName;
            _result.consoleApiObj = this;
            _result.remainingStr = remainingStr;
         }
      }
   }
};

ConsoleApi.prototype.myObj = function() {
   return this.gang.findObject(this.myObjuName);
};

ConsoleApi.prototype.ls = function(_params, _callback) {
   this.checkParams(0, _params);
   var result = this.filterScope("").hits;

   for (var i = 0; i < result.length; ++i) {
      result[i] = result[i].replace(this.fullScopeName+":", "");
   }

   _callback(null, result);
};

ConsoleApi.prototype.cat = function(_params, _callback) {
   _callback(null, {});
};

ConsoleApi.prototype.sessionClosed = function(_consoleApiObjVars, _sessionId) {
};

module.exports = exports = ConsoleApi;
