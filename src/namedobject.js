var util = require('./util');
var AsyncEmitter = require('./asyncemitter');

function NamedObject(_config, _owner) {
   AsyncEmitter.call(this);

   // Allow the creation of a named root
   if (_owner && (typeof _owner === "string")) {
      this.owner = null;
      this.fullName = _owner;
      this.name = _config.name;
      this.type = _config.type;
   }
   else {

      if (_config.name[0] === ":") {
         this.owner = _owner.findOwner(_config.name);

         if (this.owner) {
            this.name = _config.name.replace(this.owner.fullName+":", ""); 
         }
         else {
            console.error("namedobject:"+_config.name+ ": Owner not found!");
            process.exit(2);
         }
      }
      else {
         this.owner = _owner;
         this.name = _config.name;
      }

      this.fullName = this.owner ? this.owner.fullName + ":" + this.name : ":";
      this.type = _config.type;
   }

   this.myNamedObjects = {};
   
   if (this.owner) {
      this.owner.addChildNamedObject(this);
   }

   this.setMaxListeners(0);
}

util.inherits(NamedObject, AsyncEmitter);

NamedObject.prototype.setOwner = function(_owner) {

   if (this.owner) {
      this.owner.removeChildNamedObject(this);
   }

   this.owner = _owner;
   var oldFullName = this.fullName;
   this.fullName = this.owner ? this.owner.fullName + ":" + this.name : this.name;
   
   if (this.owner) {
      this.owner.addChildNamedObject(this);
   }

   if (this.fullName !== oldFullName) {

      for (var child in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(child)) {
            this.myNamedObjects[child].ownerHasNewName();
         }
      }
   }
};

NamedObject.prototype.findOwner = function(_fullName) {

   if (_fullName.length < 2) {
      return null;
   }

   var filterArray = _fullName.substr(2).split(":");

   if (filterArray.length <= 2) {
      return this;
   }

   filterArray.pop();
   var name = "::"+filterArray.join(":");
   var owner = this.findNamedObject(name);

   if (owner) {
      return owner;
   }
   else {
      filterArray.pop();
      name = "::"+filterArray.join(":");
      return this.findNamedObject(name);
   }
};

NamedObject.prototype.addNamedObject = function(_obj) {
   var owner = this.findOwner(_obj.fullName);

   if (!owner) {
      return false;
   }

   _obj.setOwner(owner);
   return true;
};

NamedObject.prototype.detach = function(_fullName) {
   console.log(this.fullName + ": AAAAAAAA detach()");

   if (this.owner) {
      this.owner.removeChildNamedObject(this);
   }

   this.owner = null;

   if (_fullName) {
      this.fullName = _fullName;

      for (var child in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(child)) {
            this.myNamedObjects[child].ownerHasNewName();
         }
      }
   }
};

NamedObject.prototype.setName = function(_name) {
   console.log(this.fullName + ": About to change name to "+_name);

   if (this.owner) {
      this.owner.removeChildNamedObject(this);
   }

   this.name = _name;
   this.fullName = this.owner ? this.owner.fullName + ":" + this.name : ":";

   if (this.owner) {
      this.owner.addChildNamedObject(this);
   }

   for (var child in this.myNamedObjects) {

      if (this.myNamedObjects.hasOwnProperty(child)) {
         this.myNamedObjects[child].ownerHasNewName();
      }
   }
};

NamedObject.prototype.ownerHasNewName = function() {
   this.fullName = this.owner ? this.owner.fullName + ":" + this.name : ":";

   for (var child in this.myNamedObjects) {

      if (this.myNamedObjects.hasOwnProperty(child)) {
         this.myNamedObjects[child].ownerHasNewName();
      }
   }
};

NamedObject.prototype.validate = function(_includeChildren) {
   var str =  _includeChildren ? " and all children" : "";
   console.log(this.fullName + ": Validating object" + str);

   if (_includeChildren) {

      for (var obj in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(obj)) {
            this.myNamedObjects[obj].validate(_includeChildren);
         }
      }
   }
};

NamedObject.prototype.invalidate = function(_includeChildren) {
   var str =  _includeChildren ? " and all children" : "";
   console.log(this.fullName + ": Invalidating object" +str);

   if (_includeChildren) {

      for (var obj in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(obj)) {
            this.myNamedObjects[obj].invalidate(_includeChildren);
         }
      }
   }
};

NamedObject.prototype.addChildNamedObject = function(_namedObject) {
   this.myNamedObjects[_namedObject.name] = _namedObject;
};

NamedObject.prototype.removeChildNamedObject = function(_namedObject) {
   delete this.myNamedObjects[_namedObject.name];
};

NamedObject.prototype.stripMyName = function(_name) {
   var myName = this.owner ? this.name : ":";

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
   var obj = null;

   util.iterate(this.myNamedObjects, 0, (_obj) => {
      if (_obj.name === filterArray[0]) { obj = _obj; return true; }
   });

   if (obj) {
      return obj.findNamedObject(newName);
   }
   else {
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
   var matchString = filterArray[0];
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
      result = namedObject.filterName((filterArray.length === 1) ? filterArray[0] : filterArray.join(":"));

      if (!result.namedObject) {
         result.namedObject = namedObject;
      }
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
