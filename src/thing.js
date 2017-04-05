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

// Actually update the property value and let all interested parties know
// Also used to navigate down the composite thing tree to update a property shared by all
// things with the composite thing (_data.alignWithParent)
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (_data.alignWithParent) {
      var propertyOldValue = _data.propertyOldValue;

      if (_data.manualPropertyChange && !this.props[_propName].manualMode) {
         this.props[_propName].setManualMode(true);
      }

      if (!Source.prototype.updateProperty.call(this, _propName, _propValue, _data)) {
         this.emitPropertyChange(_propName, _propValue, propertyOldValue, _data);
      }

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].updateProperty(_propName, _propValue, _data);
         }
      }
   }
   else {
      var propertyOldValue = this.value;

      Source.prototype.updateProperty.call(this, _propName, _propValue, _data);

      if (this.parent) {
         this.parent.childPropertyChanged(_propName, _propValue, propertyOldValue, this, _data);
      }
      else {
         _data.alignWithParent = true;
         _data.propertyOldValue = propertyOldValue;

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].updateProperty(_propName, _propValue, _data);
            }
         }
      }
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
      this.updateProperty(_propName, _propValue, _data);
   }
};

module.exports = exports = Thing;
