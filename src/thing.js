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
   }
};

Thing.prototype.addThing = function(_thing) {
   this.things[_thing.uName] = _thing;
};

Thing.prototype.updateProperty = function(_propName, _propValue, _data) {

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].setProperty(_propName, _propValue, _data);
      }
   }

   Source.prototype.updateProperty.call(this, _propName, _propValue, _data);
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

module.exports = exports = Thing;
