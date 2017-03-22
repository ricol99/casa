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

Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   _data.parentThing = this.uName;

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].setProperty(_propName, _propValue, _data);
      }
   }

   _data.parentThing == undefined;
   var oldPropValue = this.value;
   Source.prototype.updateProperty.call(this, _propName, _propValue, _data);

   if (this.parent) {
      this.parent.childPropertyChanged(_propName, _propValue, oldPropValue, this);
   }
};

Thing.prototype.getProperty = function(_property) {
   var value =  Source.prototype.getProperty.call(this, _property);

   if (value == undefined) {

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            var value = this.things[thing].getProperty(_property);

            if (value != undefined) {
               break;
            }
         }
      }
   }

   return value;
};

Thing.prototype.getAllProperties = function(_allProps) {

   Source.prototype.getAllProperties.call(this, _allProps);

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].getAllProperties(_allProps);
      }
   }
};

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _propOldValue, _child) {

   if (!this.props.hasOwnProperty(_propName)) {
      this.emitPropertyChange(_propName, _propValue, _propOldValue);

      if (this.parent) {
         this.parent.childPropertyChanged(_propName, _propValue, _propOldValue, this);
      }
   }

};

module.exports = exports = Thing;
