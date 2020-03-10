var util = require('./util');
var AsyncEmitter = require('./asyncemitter');

function NamedObject(_uName, _owner) {
   AsyncEmitter.call(this);

   this.owner = _owner ? _owner : null;
   this.uName = _uName;
   this.sName = this.uName.split(":")[1];
   this.fullName = this.owner ? this.owner.fullName + ":" + this.uName : "::" + this.uName;

   this.setMaxListeners(0);
}

util.inherits(NamedObject, AsyncEmitter);

NamedObject.prototype.setOwner = function(_owner) {
   this.fullName = this.owner ? this.owner.fullName + ":" + this.uName : this.uName;
};

NamedObject.prototype.addNamedObject = function(_newObj, _collection) {
   var ret = false;
   var scopeLeft = _newObj.fullName.replace(this.fullName);

   if (scopeLeft[0] === ':') {
      scopeLeft = scopeLeft.substr(1);
   }

   if (scopeLeft === _newObj.uName) {
      util.add(_collection, _newObj, _newObj.uName);
      return true;
   }
      
   var filterArray = scopeLeft.split(":");

   if (filterArray.length === 0) {
      console.error(this.uName + ": addNamedObject() Cannot add object as it already exists!");
      return false;
   }

   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];
   var obj = null;

   util.iterate(_collection, 0, (_obj) => {
      if (_obj.uName === matchString) { obj = _obj; return true; }
   });

   return obj ? obj.addNamedObject(_newObj) : false;
};

NamedObject.prototype.findNamedObject = function(_scope, _collections) {
   var ret = null;
   console.log(this.uName+": AAAAAA _scope="+_scope);

   if (!_collections) {
      return null;
   }

   console.log(this.uName+": AAAAA BBBBBB _collection length="+_collections.length);

   for (var i = 0; i < _collections.length; ++i) {
   console.log(this.uName+": AAAAA CCCCCC _scope="+_scope);
      ret = this.findNamedObjectInternal(_scope, _collections[i]);

      if (ret) {
         break;
      }
   }

   return ret;
};

NamedObject.prototype.findNamedObjectInternal = function(_scope, _collection)  {
   var result = null;
   var filterArray = _scope.split(":");
   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];
   var obj = null;

   util.iterate(_collection, 0, (_obj) => {
      console.log("AAAA obj uName="+_obj.uName);
      if (_obj.uName === matchString) { obj = _obj; return true; }
   });

   console.log("AAAAA matchstring="+matchString);

   if (obj) {
   console.log("AAAAA CCCCC");
      filterArray.splice(0, (filterArray.length >= 2) ? 2 : 1);

      if (filterArray.length > 0) {
   console.log("AAAAA XXXX");
         var a = (filterArray.length === 1) ? filterArray[0] : filterArray.join(":");
         console.log("AAAAA newScope="+a);
         return obj.findNamedObject((filterArray.length === 1) ? filterArray[0] : filterArray.join(":"));
      }
      else {
         return obj;
      }
   }
   else {
   console.log("AAAAA ZZZZ");
      return null;
   }
};

module.exports = exports = NamedObject;
