var util = require('./util');
var Source = require('./source');
var Gang = require('./gang');

function Thing(_config, _owner) {
   var gang = Gang.mainInstance();
   var topOfTransaction = _config.hasOwnProperty("notTopOfTransaction") ? false : !_config.notTopOfTransaction;
   delete _config.notTopOfTransaction;

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

   var parent = { public: true, protected: false, private: false, parent: true, children: false, both: true };
   var child = { public: true, protected: true, private: false, parent: false, children: true, both: true };

   if (_config.hasOwnProperty('ignorePropagation')) {
      this.ignoreParent = parent.hasOwnProperty(_config.ignorePropagation) ? parent[_config.ignorePropagation] : false;
      this.ignoreChildren = child.hasOwnProperty(_config.ignorePropagation) ? child[_config.ignorePropagation] : false;
   }
   else {
      this.ignoreParent = (_config.hasOwnProperty('ignoreParent')) ? _config.ignoreParent : false;
      this.ignoreChildren = (_config.hasOwnProperty('ignoreChildren')) ? _config.ignoreChildren : false;
   }

   if (_config.hasOwnProperty('propagation')) {
      this.propagateToParent = parent.hasOwnProperty(_config.propagation) ? parent[_config.propagation] : true;
      this.propagateToChildren = child.hasOwnProperty(_config.propagation) ? child[_config.propagation] : true;
   }
   else {
      this.propagateToParent = (_config.hasOwnProperty('propagateToParent')) ? _config.propagateToParent : true;
      this.propagateToChildren = (_config.hasOwnProperty('propagateToChildren')) ? _config.propagateToChildren : true;
   }

   if (_config.hasOwnProperty("things") && _config.things.length > 0) {

      for (var i = 0; i < _config.things.length; ++i) {
         _config.things[i].notTopOfTransaction = true;
      }
   }

   this.createChildren(_config.things, "thing", this);

   if (topOfTransaction) {
      this.getTopThing().sortOutInheritedProperties();
   }
}

util.inherits(Thing, Source);

// Used to classify the type and understand where to load the javascript module
Thing.prototype.superType = function(_type) {
   return "thing";
};

// Called when system state is required
Thing.prototype.export = function(_exportObj) {
   Source.prototype.export.call(this, _exportObj);
};   

// Called when system state is required
Thing.prototype.import = function(_importObj) {
   Source.prototype.import.call(this, _importObj);
};   

Thing.prototype.coldStart = function() {
   Source.prototype.coldStart.call(this);
   console.log(this.uName + ": Cold starting child things....");

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].coldStart();
      }
   }
};

Thing.prototype.hotStart = function() {
   Source.prototype.hotStart.call(this);
};

Thing.prototype.sortOutInheritedProperties = function() {
   console.log(this.uName+": sortOutInheritedProperties()");

   util.setTimeout( () => {
      this.inheritChildProps();
      this.inheritParentProps();
      this.casa.scheduleRefreshSourceListeners();
   }, 50);
};

// Actually update the property value and let all interested parties know
// Also used to navigate down the composite thing tree to update a property shared by all
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   var data = (_data) ? _data : { sourceName: this.uName };
   var newValue = _propValue;
   var prop = this.properties.hasOwnProperty(_propName) ? this.properties[_propName] : null;

   var ignoreParent = (prop && prop.hasOwnProperty("ignoreParent")) ? prop.ignoreParent : this.ignoreParent;
   var propagateToChildren = (prop && prop.hasOwnProperty("propagateToChildren")) ? prop.propagateToChildren : this.propagateToChildren;
   var propagateToParent = (prop && prop.hasOwnProperty("propagateToParent")) ? prop.propagateToParent : this.propagateToParent;

   if (data.alignWithParent) {

      if (!ignoreParent) {

         if (prop) {
            data.local = prop.local;
         }

         if (data.transaction) {
            this.currentTransaction = data.transaction;
         }

         newValue =  Source.prototype.updateProperty.call(this, _propName, newValue, data);

         if (propagateToChildren) {

            for (var thing in this.things) {

               if (this.things.hasOwnProperty(thing)) {
                  newValue = this.things[thing].updateProperty(_propName, newValue, data);
               }
            }
         }
      }
   }
   else {

      var updateProp = (data.hasOwnProperty("coldStart") && data.coldStart) ||
                       (prop && prop.alwaysUpdate()) ||
                       (prop && (_propValue !== prop.value));

      if (!updateProp) {
      //if (!(data.hasOwnProperty("coldStart") && data.coldStart) && prop && (_propValue === prop.value)) {
         return _propValue;
      }

      if (prop) {
         data.propertyOldValue = prop.value;
      }

      data.alignWithParent = true;

      if (!data.hasOwnProperty("transaction")) {
         data.transaction = this.checkTransaction();
      }

      if (this.local) {
         data.local = true;
      }

      newValue = Source.prototype.updateProperty.call(this, _propName, _propValue, data);
      var needToUpdateChildren = propagateToChildren;

      if (!this.topLevelThing && propagateToParent) {
         needToUpdateChildren = !this.owner.childPropertyChanged(_propName, newValue, this, data);
      }

      if (needToUpdateChildren) {
         data.alignWithParent = true;

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].updateProperty(_propName, newValue, data);
            }
         }
      }
   }

   return newValue;
};

Thing.prototype.inheritChildProps = function() {

   if (!this.ignoreChildren) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing) && this.things[thing].inheritChildProps()) {

            for (var prop in this.things[thing].properties) {

               if (this.things[thing].properties.hasOwnProperty(prop)) {

                  if (!this.properties.hasOwnProperty(prop)) {
                     console.log(this.uName + ": Adding new prop from child "+prop);
                     var oSpec = { name: prop, initialValue: this.things[thing].properties[prop].value,
                                   local: this.things[thing].properties[prop].local, childInherited: true };

                     this.ensurePropertyExists(prop, "property", oSpec, this.config);
                  }
               }
            }
         }
      }
   }

   return this.propagateToParent;
};

Thing.prototype.inheritParentProps = function(_parentProps) {

   if (!this.ignoreParent) {

      if (_parentProps) {

         for (var prop in _parentProps) {
  
            if (_parentProps.hasOwnProperty(prop) && !this.properties.hasOwnProperty(prop)) {
               console.log(this.uName + ": Adding new prop from parent "+prop);
               var oSpec = { name: prop, initialValue: _parentProps[prop].value,
                             local: true, parentInherited: true };

               this.ensurePropertyExists(prop, "property", oSpec, this.config);
            }
         }
      }

      if (this.propagateToChildren) {
   
         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].inheritParentProps(this.properties);
            }
         }
      }
   }
};

Thing.prototype.getAllProperties = function(_allProps, _ignorePropogation) {

   if (!this.ignoreParent && (_ignorePropogation || (this.topLevelThing || this.propagateToParent))) {
      Source.prototype.getAllProperties.call(this, _allProps);

      if (!this.ignoreChildren) {

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].getAllProperties(_allProps, _ignorePropogation);
            }
         }
      }
   }
};

Thing.prototype.findAllProperties = function(_allProps, _ignorePropogation) {

   if (!this.ignoreParent && (_ignorePropogation || (this.topLevelThing || this.propagateToParent))) {
      Source.prototype.findAllProperties.call(this, _allProps);

      if (!this.ignoreChildren) {

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].findAllProperties(_allProps, _ignorePropogation);
            }
         }
      }
   }
};

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _child, _data) {
   var prop = this.properties.hasOwnProperty(_propName) ? this.properties[_propName] : null;
   var ignoreChildren = (prop && prop.hasOwnProperty("ignoreChildren")) ? prop.ignoreChildren : this.ignoreChildren;
   var propagateToChildren = (prop && prop.hasOwnProperty("propagateToChildren")) ? prop.propagateToChildren : this.propagateToChildren;
   var propagateToParent = (prop && prop.hasOwnProperty("propagateToParent")) ? prop.propagateToParent : this.propagateToParent;

   if (ignoreChildren) {
      return false;
   }

   if (_data.transaction) {
      this.currentTransaction = _data.transaction;
   }

   var ret = propagateToChildren;

   if (!this.topLevelThing && propagateToParent) {
      ret = ret && this.owner.childPropertyChanged(_propName, _propValue, this, _data);
   }
   else {
      var newValue = this.updateProperty(_propName, _propValue, _data);

      if (newValue !== _propValue) {

         if (this.updateProperty(_propName, newValue, _data) !== newValue) {
            console.error(this.uName+": Unable aligned property "+_propName+" in composite object");
         }
      }
   }

   return ret;
};

Thing.prototype.childRaisedEvent = function(_eventName, _child, _data) {
   var event = this.events.hasOwnProperty(_eventName) ? this.events[_eventName] : null;
   var ignoreChildren = (event && event.hasOwnProperty("ignoreChildren")) ? event.ignoreChildren : this.ignoreChildren;
   var propagateToChildren = (event && event.hasOwnProperty("propagateToChildren")) ? event.propagateToChildren : this.propagateToChildren;
   var propagateToParent = (event && event.hasOwnProperty("propagateToParent")) ? event.propagateToParent : this.propagateToParent;

   if (ignoreChildren) {
      return false;
   }

   if (_data.transaction) {
      this.currentTransaction = _data.transaction;
   }

   var ret = propagateToChildren;

   if (!this.topLevelThing && propagateToParent) {
      ret = ret && this.owner.childRaisedEvent(_eventName, this, _data);
   }
   else {
      _data.alignWithParent = true;
      this.raiseEvent(_eventName, _data);
   }

   return ret;
};

Thing.prototype.raiseEvent = function(_eventName, _data) {
   var event = this.events.hasOwnProperty(_eventName) ? this.events[_eventName] : null;
   var ignoreChildren = (event && event.hasOwnProperty("ignoreChildren")) ? event.ignoreChildren : this.ignoreChildren;
   var propagateToChildren = (event && event.hasOwnProperty("propagateToChildren")) ? event.propagateToChildren : this.propagateToChildren;
   var propagateToParent = (event && event.hasOwnProperty("propagateToParent")) ? event.propagateToParent : this.propagateToParent;

   var data = (_data) ? _data : { sourceName: this.uName };

   if (data.alignWithParent) {

      if (data.transaction) {
         this.currentTransaction = data.transaction;
      }

      Source.prototype.raiseEvent.call(this, _eventName, data);

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].raiseEvent(_eventName, data);
         }
      }
   }
   else {

      if (this.topLevelThing || !propagateToParent) {
         Source.prototype.raiseEvent.call(this, _eventName, data);
      }

      var needToUpdateChildren = propagateToChildren;

      if (!this.topLevelThing && propagateToParent) {
         needToUpdateChildren = !this.owner.childRaisedEvent(_eventName, this, data);
      }

      if (needToUpdateChildren) {
         data.alignWithParent = true;

         if (!data.hasOwnProperty("transaction")) {
            data.transaction = this.checkTransaction();
         }

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].raiseEvent(_eventName, data);
            }
         }
      }
   }
};

Thing.prototype.isTopLevelThing = function() {
   return this.topLevelThing;
};

Thing.prototype.getTopThing = function() {
   return this.topLevelThing ? this : this.owner.getTopThing();
};

Thing.prototype.ownerHasNewName = function() {
   Source.prototype.ownerHasNewName.call(this);

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].ownerHasNewName();
      }
   }
};

Thing.prototype.removeChildNamedObject = function(_child) {
   console.log(this.uName + ": removeChildNamedObject() child="+_child.uName);
   Source.prototype.removeChildNamedObject.call(this, _child);
   this.getTopThing().refreshChildInheritedProperties();
};

Thing.prototype.refreshChildInheritedProperties = function() {
   console.log(this.uName + ": refreshChildInheritedProperties()");

   if (!this.ignoreChildren) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing) && this.things[thing].refreshChildInheritedProperties()) {

            for (var prop in this.things[thing].properties) {

               if (this.things[thing].properties.hasOwnProperty(prop)) {

                  if (this.properties.hasOwnProperty(prop) && this.properties[prop].config.childInherited) {
                     this.properties[prop].config.stillChildInherited = true;
                  }
               }
            }
         }
      }

      for (var prop2 in this.properties) {

         if (this.properties.hasOwnProperty(prop2) && this.properties[prop2].config.childInherited) {

            if (this.properties[prop2].config.stillChildInherited) {
               delete this.properties[prop2].config.stillChildInherited;
            }
            else {
               console.log(this.uName + ": Removing child inherited property "+prop2+" because it no longer exists in any child thing");
               delete this.properties[prop2];
            }
         }
      }
   }

   return this.propagateToParent;
};

Thing.prototype.loseListeners = function(_includeChildren) {
   Source.prototype.loseListeners.call(this, _includeChildren);

   if (_includeChildren) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].loseListeners(_includeChildren);
         }
      }
   }
};

module.exports = exports = Thing;
