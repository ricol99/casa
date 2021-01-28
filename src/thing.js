var util = require('./util');
var Source = require('./source');
var Gang = require('./gang');

function Thing(_config, _owner) {
   var gang = Gang.mainInstance();

   if (_owner && (_owner !== gang) && (_owner !== gang.casa)) {

      if (_config.hasOwnProperty("local") && !_config.local && _owner.local) {
         console.error(this.uName + ": Config broken as non-local thing owned by local thing!");
         process.exit(2);
      }

      if (!_config.hasOwnProperty("local")) {
         _config.local = true;
      }
   }
   else {
      this.topLevelThing = true;
   }

   Source.call(this, _config, _owner);

   this.displayName = _config.displayName;
   this.ignoreParent = (_config.hasOwnProperty('ignoreParent')) ? _config.ignoreParent : false;
   this.ignoreChildren = (_config.hasOwnProperty('ignoreChildren')) ? _config.ignoreChildren : false;
   this.propogateToParent = (_config.hasOwnProperty('propogateToParent')) ? _config.propogateToParent : true;
   this.propogateToChildren = (_config.hasOwnProperty('propogateToChildren')) ? _config.propogateToChildren : true;
   this.things = {};

   if (!this.topLevelThing) {
      this.owner.addThing(this);
   }
}

util.inherits(Thing, Source);

Thing.prototype.addThing = function(_thing) {
   this.things[_thing.name] = _thing;
};

// Actually update the property value and let all interested parties know
// Also used to navigate down the composite thing tree to update a property shared by all
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   var data = (_data) ? _data : { sourceName: this.uName };

   if (data.alignWithParent) {

      if (!this.ignoreParent) {
         Source.prototype.updateProperty.call(this, _propName, _propValue, data);

         if (this.propogateToChildren) {

            for (var thing in this.things) {

               if (this.things.hasOwnProperty(thing)) {
                  this.things[thing].updateProperty(_propName, _propValue, data);
               }
            }
         }
      }
   }
   else {

      if (!(data.hasOwnProperty("coldStart") && data.coldStart) && this.props.hasOwnProperty(_propName) && (_propValue === this.props[_propName].value)) {
         return true;
      }

      data.propertyOldValue = this.value;
      data.alignWithParent = true;
      Source.prototype.updateProperty.call(this, _propName, _propValue, data);
      var needToUpdateChildren = this.propogateToChildren;

      if (!this.topLevelThing && this.propogateToParent) {
         needToUpdateChildren = !this.owner.childPropertyChanged(_propName, _propValue, this, data);
      }

      if (needToUpdateChildren) {
         data.alignWithParent = true;

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].updateProperty(_propName, _propValue, data);
            }
         }
      }
   }
};

Thing.prototype.inheritChildProps = function() {

   if (!this.ignoreChildren) {
      var childProps = {};

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].getAllProperties(childProps);
         }
      }

      for (var prop in childProps) {

         if (childProps.hasOwnProperty(prop)) {
            var oSpec = (childProps[prop] == undefined) ? { name: prop } : { name: prop, initialValue: childProps[prop] };
            this.ensurePropertyExists(prop, "property", oSpec, this.config);
         }
      }
   }
};

Thing.prototype.getAllProperties = function(_allProps, _ignorePropogation) {

   if (!this.ignoreParent && (_ignorePropogation || (this.topLevelThing || this.propogateToParent))) {
      Source.prototype.getAllProperties.call(this, _allProps);

      if (!this.ignoreChildren) {

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].getAllProperties(_allProps);
            }
         }
      }
   }
};

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _child, _data) {

   if (this.ignoreChildren) {
      return false;
   }

   var ret = this.propogateToChildren;

   if (!this.topLevelThing && this.propogateToParent) {
      ret = ret && this.owner.childPropertyChanged(_propName, _propValue, this, _data);
   }
   else {
      this.updateProperty(_propName, _propValue, _data);
   }

   return ret;
};

Thing.prototype.childRaisedEvent = function(_eventName, _child, _data) {

   if (!this.ignoreChildren) {

      if (!this.topLevelThing) {
         this.owner.childRaisedEvent(_eventName, this, _data);
      }
      else {
         _data.alignWithParent = true;
         this.raiseEvent(_eventName, _data);
      }
   }
};

Thing.prototype.raiseEvent = function(_eventName, _data) {

   var data = (_data) ? _data : { sourceName: this.uName };

   if (data.alignWithParent) {
      Source.prototype.raiseEvent.call(this, _eventName, data);

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].raiseEvent(_eventName, data);
         }
      }
   }
   else {
      this.childRaisedEvent(_eventName, this, data);
   }
};

Thing.prototype.isTopLevelThing = function() {
   return this.topLevelThing;
};

Thing.prototype.getTopThing = function() {
   return this.topLevelThing ? this : this.owner.getTopThing();
};

Thing.prototype.ownerHasNewName = function() {
   NamedObject.prototype.ownerHasNewName.call(this);

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].ownerHasNewName();
      }
   }
};

module.exports = exports = Thing;
