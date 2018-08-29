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

      if (!Source.prototype.updateProperty.call(this, _propName, _propValue, data)) {
         this.emitPropertyChange(_propName, _propValue, data);
      }

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

      if (this.parent && this.propogateToParent) {
         this.parent.childPropertyChanged(_propName, _propValue, this, data);
      }
      else if (this.propogateToChildren) {
         data.alignWithParent = true;

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].updateProperty(_propName, _propValue, data);
            }
         }
      }
   }
};

Thing.prototype.hasProperty = function(_property) {
   var result = Source.prototype.hasProperty.call(this, _property);

   if (!result && this.propogateToChildren) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            result = this.things[thing].hasProperty(_property);

            if (result) {
               break;
            }
         }
      }
   }

   return result;
};

Thing.prototype.getProperty = function(_property) {
   var value;

   if (Source.prototype.hasProperty.call(this, _property)) {
      value = Source.prototype.getProperty.call(this, _property); 
   }
   else if (this.propogateToChildren) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            var exists = this.things[thing].hasProperty(_property);

            if (exists) {
               value = this.things[thing].getProperty(_property);
               break;
            }
         }
      }
   }

   return value;
};


Thing.prototype.setProperty = function(_propName, _propValue, _data) {

   var ret = Source.prototype.setProperty.call(this, _propName, _propValue, _data);

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {

         if (this.things[thing].setProperty(_propName, _propValue, _data)) {
            ret = true;
         }
      }
   }

   return ret;
};

Thing.prototype.getAllProperties = function(_allProps) {

   Source.prototype.getAllProperties.call(this, _allProps);

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].getAllProperties(_allProps);
      }
   }
};

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _child, _data) {

   if (this.parent) {
      this.parent.childPropertyChanged(_propName, _propValue, this, _data);
   }
   else {
      _data.alignWithParent = true;
      this.updateProperty(_propName, _propValue, _data);
   }
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
