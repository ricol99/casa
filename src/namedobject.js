var util = require('./util');
var AsyncEmitter = require('./asyncemitter');

var constructors = {};

function NamedObject(_config, _owner) {
   AsyncEmitter.call(this);
   this.config = _config;

   // Allow the creation of a named root
   if (_owner && (typeof _owner === "string")) {
      this.owner = null;
      this.uName = _owner;
      this.name = _config.name;
      this.type = _config.type;
   }
   else {

      if (_config.name[0] === ":") {
         this.owner = _owner.findOwner(_config.name);

         if (this.owner) {
            this.name = _config.name.replace(this.owner.uName+":", ""); 
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

      this.uName = this.owner ? this.owner.uName + ":" + this.name : ":";
      this.type = _config.type;
   }

   if (_config.hasOwnProperty('displayName')) {
      this.displayName = _config.displayName;
   }

   this.myNamedObjects = {};
   
   if (this.owner) {
      this.owner.addChildNamedObject(this);
   }

   if (_config && _config.hasOwnProperty("transient")) {
      this.transient = _config.transient;
   }

   this.setMaxListeners(0);
}

util.inherits(NamedObject, AsyncEmitter);

// Used to classify the type and understand where to load the javascript module
NamedObject.prototype.superType = function(_type) {
   return null;
};

// Called when current state required
NamedObject.prototype.export = function(_exportObj) {
   AsyncEmitter.prototype.export.call(this, _exportObj);
   _exportObj.superType = this.superType();
   _exportObj.name = this.name;
   _exportObj.uName = this.uName;
   _exportObj.myNamedObjects = {};

   for (var namedObj in this.myNamedObjects) {

      if (this.myNamedObjects.hasOwnProperty(namedObj)) {
         _exportObj.myNamedObjects[namedObj]= {};
         this.myNamedObjects[namedObj].export(_exportObj.myNamedObjects[namedObj]);
      }
   }
};

// Called when current state required
NamedObject.prototype.import = function(_importObj) {
   AsyncEmitter.prototype.import.call(this, _importObj);
   //this.superType = _importObj.superType;
   //this.name = _importObj.name;
   //this.uName = _importObj.uName;
   //this.myNamedObjects = {};

   for (var namedObj in _importObj.myNamedObjects) {

      if (this.myNamedObjects.hasOwnProperty(namedObj)) {
         this.myNamedObjects[namedObj].import(_importObj.myNamedObjects[namedObj]);
      }
   }
};

NamedObject.prototype.coldStart = function() {
   AsyncEmitter.prototype.coldStart.call(this);
};

NamedObject.prototype.hotStart = function(_ignoreChildren) {
   AsyncEmitter.prototype.hotStart.call(this);

   for (var namedObj in this.myNamedObjects) {

      if (this.myNamedObjects.hasOwnProperty(namedObj)) {
         this.myNamedObjects[namedObj].hotStart();
      }
   }
};

NamedObject.prototype.findOrCreate = function(_uName, _constructor, _constructorParams) {
   var nextObjName = this.stripMyUName(_uName);

   if (nextObjName === null) {
      return null;
   }

   if (nextObjName === "") {
      return this;
   }

   var spr = nextObjName.split(":");

   if (spr.length === 0) {
      return this;
   }

   if (this.myNamedObjects.hasOwnProperty(spr[0])) {
      return this.myNamedObjects[spr[0]].findOrCreate(_uName, _constructor, _constructorParams);
   }

   return this.create(_uName, false, false, _constructor, _constructorParams);
};

NamedObject.prototype.create = function(_uName, _replace, _copyChildren, _constructor, _constructorParams) {
   var nextObjName = this.stripMyUName(_uName);

   if (nextObjName === null) {
      return null;
   }

   if (nextObjName === "") {

      if (!this.owner) {

         if (!_replace) {
            return null;
         }

         // Replacing the root!
         var newNamedObj = _constructor(this.name, null, _constructorParams);

         if (newNamedObj) {

            if (_copyChildren) {

               for (var child in this.myNamedObjects) {

                  if (this.myNamedObjects.hasOwnProperty(child)) {
                     this.myNamedObjects[child].setOwner(newNamedObj);
                  }
               }
            }
            return newNamedObj;
         }
         else {
            return null;
         }
      }
      else {
         return this;
      }
   }

   var spr = nextObjName.split(":");

   if (this.myNamedObjects.hasOwnProperty(spr[0])) {

      if (spr.length > 1) {
         return this.myNamedObjects[spr[0]].create(_uName, _replace, _copyChildren, _constructor, _constructorParams);
      }
      else if (!_replace) { // spr length is 1 and we need to replace
         return null;
      }
      else {
         var existingNamedObj = this.myNamedObjects[spr[0]];
         var newNamedObj = _constructor(this.uName+":"+spr[0], this, _constructorParams);

         if (newNamedObj) {

            if (_copyChildren) {

               for (var child in existingNamedObj.myNamedObjects) {

                  if (existingNamedObj.myNamedObjects.hasOwnProperty(child)) {
                     existingNamedObj.myNamedObjects[child].setOwner(newNamedObj);
                  }
               }
            }

            return newNamedObj.create(_uName, _replace, _copyChildren, _constructor, _constructorParams);
         }
         else {
            return null;
         }
      }
   }
   else {
      var nextObj = _constructor(this.uName+":"+spr[0], this, _constructorParams);

      if (nextObj) {
         return nextObj.create(_uName, _replace, _copyChildren, _constructor, _constructorParams);
      }
      else {
         return null;
      }
   }
};

NamedObject.prototype.setOwner = function(_owner) {

   if (this.owner) {
      this.owner.removeChildNamedObject(this);
   }

   this.owner = _owner;
   var oldUName = this.uName;
   this.uName = this.owner ? this.owner.uName + ":" + this.name : this.name;
   
   if (this.owner) {
      this.owner.addChildNamedObject(this);
   }

   if (this.uName !== oldUName) {

      for (var child in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(child)) {
            this.myNamedObjects[child].ownerHasNewName();
         }
      }
   }
};

NamedObject.prototype.findOwner = function(_uName) {

   if (_uName.length < 2) {
      return null;
   }

   var filterArray = _uName.substr(2).split(":");

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
   var owner = this.findOwner(_obj.uName);

   if (!owner) {
      return false;
   }

   _obj.setOwner(owner);
   return true;
};

NamedObject.prototype.detach = function(_uName) {

   if (this.owner) {
      this.owner.removeChildNamedObject(this);
   }

   this.owner = null;

   if (_uName) {
      this.uName = _uName;

      for (var child in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(child)) {
            this.myNamedObjects[child].ownerHasNewName();
         }
      }
   }
};

NamedObject.prototype.setName = function(_name) {
   console.log(this.uName + ": About to change name to "+_name);

   if (this.owner) {
      this.owner.removeChildNamedObject(this);
   }

   this.name = _name;
   this.uName = this.owner ? this.owner.uName + ":" + this.name : ":";

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
   this.uName = this.owner ? this.owner.uName + ":" + this.name : ":";

   for (var child in this.myNamedObjects) {

      if (this.myNamedObjects.hasOwnProperty(child)) {
         this.myNamedObjects[child].ownerHasNewName();
      }
   }
};

NamedObject.prototype.validate = function(_includeChildren) {
   var str =  _includeChildren ? " and all children" : "";
   console.log(this.uName + ": Validating object" + str);

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
   console.log(this.uName + ": Invalidating object" +str);

   if (_includeChildren) {

      for (var obj in this.myNamedObjects) {

         if (this.myNamedObjects.hasOwnProperty(obj)) {
            this.myNamedObjects[obj].invalidate(_includeChildren);
         }
      }
   }
};

NamedObject.prototype.require = function(_type, _superType, _loadPath) {
   var path = '';
   var module;

   if (_loadPath) {
      module = './' + _loadPath + (_loadPath.endsWith("s") ? '/' : 's/') + _type;
   }
   else if (_superType && (_superType !== _type)) {
      module = _superType.endsWith("y") ? './' + _superType.slice(0, -1) + 'ies/' + _type : './' + _superType + 's/' + _type;
   }
   else {
     module = "./" + _type;
   }

   if (!constructors[module]) {
      console.log('loading more code: ' + module);

      try {
         constructors[module] = require(module);
      }
      catch (_err) {
         process.stderr.write(util.inspect(_err));
         return null;
      }
   }
   return constructors[module];
};

NamedObject.prototype.getSuperTypeCollection = function(_superType) {
   return _superType ? this[_superType.endsWith("y") ? _superType.slice(0, -1) + 'ies' : _superType + "s"] : null;
};

NamedObject.prototype.findOrCreateSuperTypeCollection = function(_superType) {
   var collectionName = _superType.endsWith("y") ? _superType.slice(0, -1) + 'ies' : _superType + "s";

   if (!this[collectionName]) {
      this[collectionName] = {};
   }
   return this[collectionName];
};

NamedObject.prototype.createChild = function(_config, _superType, _owner) {

   if (!_config) {
      return null;
   }

   var Child = this.require(_config.type ? _config.type : _superType, _superType, _config.loadPath);
   return new Child(_config, _owner);
};

NamedObject.prototype.createChildren = function(_config, _superType, _owner) {
   this.findOrCreateSuperTypeCollection(_superType);

   if (_config) {

      for (var i = 0; i < _config.length; ++i) {
         var Child = this.require(_config[i].type ? _config[i].type : _superType, _superType, _config[i].loadPath);
         new Child(_config[i], _owner);
      }
   }
};

NamedObject.prototype.addChildNamedObject = function(_namedObject) {
   this.myNamedObjects[_namedObject.name] = _namedObject;

   if (_namedObject.superType()) {
      this.findOrCreateSuperTypeCollection(_namedObject.superType())[_namedObject.name] = _namedObject;
      let collectionName = this.getSuperTypeCollection(_namedObject.superType());

      if (this.config.hasOwnProperty(collectionName) && this.config[collectionName]) {
         var found = false;

         for (var i = 0; i < this.config[collectionName].length; ++i) {

            if (this.config[collectionName][i].name === _namedObject.name) {
               found = true;
            }
         }

         if (!found) {
            this.config[collectionName].push(_namedObject.config);
         }
      }
   }
};

NamedObject.prototype.removeChildNamedObject = function(_namedObject) {
   delete this.myNamedObjects[_namedObject.name];

   if (_namedObject.superType()) {
      delete this.findOrCreateSuperTypeCollection(_namedObject.superType())[_namedObject.name];
   }
};

NamedObject.prototype.stripMyUName = function(_uName) {
   return (_uName.length > this.uName.length) ? _uName.replace(this.uName+":", "") : _uName.replace(this.uName, "");
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

   //process.stdout.write("AAAAA findNamedObject() newName="+newName+"\n");

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
   //else if (newName === "") {
      //var uName = (this.uName === ":") ? "::" : this.uName;
      //result.hits.push(uName);
      //result.namedObject = this;
      //result.name = uName;
      //result.remainingStr = "";
      //return result;
   //}

   //process.stdout.write("AAAAA filterName newName="+newName+"\n");

   var filterArray = newName.split(":");
   var matchString = filterArray[0];
   var perfectMatch = -1;
   var matches = util.filter(this.myNamedObjects, (_obj) => { return _obj.startsWith(matchString); });

   util.iterate(matches, 0, (_obj) => {

      if (_obj === matchString) {
         perfectMatch = result.hits.length;
      }

      result.hits.push(this.uName+":"+_obj+":");
   });

   if (perfectMatch !== -1) {
      var namedObject = this.myNamedObjects[matchString];

      if (filterArray.length > 1) {
         result = namedObject.filterName((filterArray.length === 1) ? filterArray[0] : filterArray.join(":"));
      }
   }
   else {
      var remainingStr = (filterArray.length === 0) ? "" : (filterArray.length === 1) ? filterArray[0] : filterArray.join(":");

      if (!result.hasOwnProperty("remainingStr") || (result.remainingStr.length > remainingStr.length)) {
         result.name = this.uName;
         result.namedObject = this;
         result.remainingStr = remainingStr;
      }
   }

   return result;
};

NamedObject.prototype.getDisplayName = function() {
   return this.hasOwnProperty("displayName") ? this.displayName : this.name;
};

module.exports = exports = NamedObject;
