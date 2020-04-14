var util = require('./util');
var AsyncEmitter = require('./asyncemitter');

function NamedObject(_uName, _owner) {
   AsyncEmitter.call(this);

   this.owner = _owner ? _owner : null;
   this.uName = _uName;
   this.sName = this.uName.split(":")[1];
   this.tName = this.uName.split(":")[0];
   this.fullName = this.owner ? this.owner.fullName + ":" + this.uName : ":";
   this.myNamedObjects = {};
   
   if (this.owner) {
      this.owner.addChildNamedObject(this);
   }

   this.setMaxListeners(0);
}

util.inherits(NamedObject, AsyncEmitter);

NamedObject.prototype.setOwner = function(_owner) {
   this.fullName = this.owner ? this.owner.fullName + ":" + this.uName : this.uName;
};

NamedObject.prototype.ownerHasNewName = function() {
   this.fullName = this.owner ? this.owner.fullName + ":" + this.uName : ":";
};

NamedObject.prototype.addChildNamedObject = function(_namedObject) {
   this.myNamedObjects[_namedObject.uName] = _namedObject;
};

NamedObject.prototype.addNamedObject = function(_newObj) {
   var ret = false;
   var nameLeft = _newObj.fullName.replace(this.fullName);

   if (nameLeft[0] === ':') {
      nameLeft = nameLeft.substr(1);
   }

   if (nameLeft === _newObj.uName) {
      util.add(this.myNamedObjects, _newObj, _newObj.uName);
      return true;
   }
      
   var filterArray = nameLeft.split(":");

   if (filterArray.length === 0) {
      console.error(this.uName + ": addNamedObject() Cannot add object as it already exists!");
      return false;
   }

   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];
   var obj = null;

   util.iterate(this.myNamedObjects, 0, (_obj) => {
      if (_obj.uName === matchString) { obj = _obj; return true; }
   });

   return obj ? obj.addNamedObject(_newObj) : false;
};

NamedObject.prototype.stripMyName = function(_name) {
   var myName = this.owner ? this.uName : ":";

   if (_name.startsWith(myName)) {
      var newName = _name.replace(myName, "");
      return (newName.length > 0) ? ((newName[0] === ':') ? newName.substr(1) : null) : "";
   }
   else {
      return null;
   }
};

NamedObject.prototype.findNamedObject = function(_name)  {
   var newName = this.stripMyName(_name);

   if (newName === null) {
      return null;
   }
   else if (newName === "") {
      return this;
   }

   var result = null;
   var filterArray = newName.split(":");
   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];
   var obj = null;

   util.iterate(this.myNamedObjects, 0, (_obj) => {
      if (_obj.uName === matchString) { obj = _obj; return true; }
   });

   if (obj) {
      return obj.findNamedObject(newName);
   }
   else {
      console.error(this.fullName + ": Named object " + newName + " not found!");
      return null;
   }
};

NamedObject.prototype.filterName = function(_name)  {
   var newName = this.stripMyName(_name);
   var result = { hits: [] };

   if (newName === null) {
      result.remainingStr = _name;
      return result;
   }
   else if (newName === "") {
      var fullName = (this.fullName === ":") ? "::" : this.fullName;
      result.hits.push(fullName);
      result.namedObject = this;
      result.name = fullName;
      result.remainingStr = "";
      return result;
   }

   process.stdout.write("AAAAA filterName newName="+newName+"\n");

   var filterArray = newName.split(":");
   var matchString = (filterArray.length === 1) ? filterArray[0] : filterArray[0]+":"+filterArray[1];
   var perfectMatch = -1;
   var matches = util.filter(this.myNamedObjects, (_obj) => { return _obj.startsWith(matchString); });

   util.iterate(matches, 0, (_obj) => {

      if (_obj === matchString) {
         perfectMatch = result.hits.length;
      }

      result.hits.push(this.fullName+":"+_obj);
   });

   if (perfectMatch !== -1) {
      var namedObject = this.myNamedObjects[matchString];
      //filterArray.splice(0, (filterArray.length >= 2) ? 2 : 1);

      //if (filterArray.length > 0) {
         result = namedObject.filterName((filterArray.length === 1) ? filterArray[0] : filterArray.join(":"));

         if (!result.namedObject) {
            result.namedObject = namedObject;
         }
      //}
      //else {
         //result.namedObject = namedObject;
         //result.name = hits[perfectMatch];
         //hits.splice(perfectMatch, 1);
         //result.remainingStr = "";
      //}
   }
   else {
      var remainingStr = (filterArray.length === 0) ? "" : (filterArray.length === 1) ? filterArray[0] : filterArray.join(":");

      if (!result.hasOwnProperty("remainingStr") || (result.remainingStr.length > remainingStr.length)) {
         result.name = this.fullName;
         result.namedObject = this;
         result.remainingStr = remainingStr;
      }
   }

   return result;
};

module.exports = exports = NamedObject;
