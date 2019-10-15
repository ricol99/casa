var util = require('./util');
var Source = require('./source');

function Thing(_config) {
   Source.call(this, _config);

   this.setMaxListeners(75);

   this.displayName = _config.displayName;
   this.propogateToParent = (_config.hasOwnProperty('propogateToParent')) ? _config.propogateToParent : true;
   this.propogateToChildren = (_config.hasOwnProperty('propogateToChildren')) ? _config.propogateToChildren : true;
   this.things = {};
}

util.inherits(Thing, Source);

Thing.prototype.setParent = function(_thing) {

   if (_thing) {
      this.parent = _thing;
      this.parent.addThing(this);
      this.local = true;
   }
};

Thing.prototype.addThing = function(_thing) {
   this.things[_thing.uName] = _thing;
};

// Actually update the property value and let all interested parties know
// Also used to navigate down the composite thing tree to update a property shared by all
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   var data = (_data) ? _data : { sourceName: this.uName };

   if (data.alignWithParent) {

      // Moving to a model where you must declare the property in the thing, if you want it to emit
      // Will out a check into sourcelistener to make sure the property there when listening is established
      // Don't check result, never emit if property is not there
      //if (!Source.prototype.updateProperty.call(this, _propName, _propValue, data)) {
         //this.emitPropertyChange(_propName, _propValue, data);
      //}
      Source.prototype.updateProperty.call(this, _propName, _propValue, data);

      if (this.propogateToChildren) {

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].updateProperty(_propName, _propValue, data);
            }
         }
      }
   }
   else {

      if (!data.coldStart && this.props.hasOwnProperty(_propName) && (_propValue === this.props[_propName].value)) {
         return true;
      }

      data.propertyOldValue = this.value;
      Source.prototype.updateProperty.call(this, _propName, _propValue, data);
      var needToUpdateChildren = this.propogateToChildren;

      if (this.parent && this.propogateToParent) {
         needToUpdateChildren = !this.parent.childPropertyChanged(_propName, _propValue, this, data);
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
   var childProps = {};

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].getAllProperties(childProps);
      }
   }

   for (var prop in childProps) {

      if (childProps.hasOwnProperty(prop)) {
         this.ensurePropertyExists(prop, "property", { initialValue: childProps[prop] }, this.config);
      }
   }
};

Thing.prototype.getAllProperties = function(_allProps) {

   if (!this.parent || this.propogateToParent) {
      Source.prototype.getAllProperties.call(this, _allProps);

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].getAllProperties(_allProps);
         }
      }
   }
};

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _child, _data) {
   var ret = this.propogateToChildren;

   if (this.parent) {
      ret = ret && this.parent.childPropertyChanged(_propName, _propValue, this, _data);
   }
   else {
      _data.alignWithParent = true;
      this.updateProperty(_propName, _propValue, _data);
   }

   return ret;
};

Thing.prototype.childRaisedEvent = function(_eventName, _child, _data) {

   if (this.parent) {
      this.parent.childRaisedEvent(_eventName, this, _data);
   }
   else {
      _data.alignWithParent = true;
      this.raiseEvent(_eventName, _data);
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

module.exports = exports = Thing;
