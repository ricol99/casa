var util = require('util');
var Source = require('./source');

function Thing(_config) {
   this.displayName = _config.displayName;
   this.things = {};

   Source.call(this, _config);
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

// Used to navigate down the composite thing tree to update a property shared by all
// things with the composite thing
Thing.prototype.alignPropertyWithParent = function(_propName, _propValue, _oldValue, _data) {

   if (_data.manualPropertyChange && !this.props[_propName].manualMode) {
      this.props[_propName].setManualMode(true);
   }

   if (!Source.prototype.updateProperty.call(this, _propName, _propValue, _data)) {
      this.emitPropertyChange(_propName, _propValue, _oldValue, _data);
   }

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].alignPropertyWithParent(_propName, _propValue, _oldValue, _data);
      }
   }
};

// Actually update the property value and let all interested parties know
// Uses the derrived class method and also informs the parent
// Only called by property - should not be called by any other class
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   var oldPropValue = this.value;
   Source.prototype.updateProperty.call(this, _propName, _propValue, _data);

   if (this.parent) {
      this.parent.childPropertyChanged(_propName, _propValue, oldPropValue, this, _data);
   }
   else {
      this.alignPropertyWithParent(_propName, _propValue, oldPropValue, _data);
   }
};

Thing.prototype.getProperty = function(_property) {
   var value =  Source.prototype.getProperty.call(this, _property);

   if (value == undefined) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            value = this.things[thing].getProperty(_property);

            if (value != undefined) {
               break;
            }
         }
      }
   }

   return value;
};


Thing.prototype.setProperty = function(_propName, _propValue, _data) {

   var ret = Source.prototype.setProperty.call(this, _propName, _propValue, _data);

   if (!ret) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {

            if (this.things[thing].setProperty(_propName, _propValue, _data)) {
               ret = true;
               break;
            }
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

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _propOldValue, _child, _data) {

   if (this.parent) {
      this.parent.childPropertyChanged(_propName, _propValue, _propOldValue, this, _data);
   }
   else {
      this.alignPropertyWithParent(_propName, _propValue, _propOldValue, _data);
   }
};

module.exports = exports = Thing;
