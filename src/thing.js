var util = require('util');
var Source = require('./source');

function Thing(_config) {
   this.displayName = _config.displayName;
   this.propogateToParent = _config.hasOwnProperty("propogateToParent") ? _config.propogateToParent : true;
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
Thing.prototype.alignPropertyWithParent = function(_propName, _propValue, _data) {

   if (_data.enterManualMode) {
      this.props[_propName].manualMode = true; // XXXX TODO Is this the right thing to do - who controls the timers?
   }
   else if (_data.leaveManualMode) {
      this.props[_propName].manualMode = false; // XXXX TODO Is this the right thing to do - who controls the timers?
   }

   if (!Source.prototype.updateProperty.call(this, _propName, _propValue, _data)) {
      this.emitPropertyChange(_propName, _propValue, _data);
   }

   for (var thing in this.things) {

      if (this.things.hasOwnProperty(thing)) {
         this.things[thing].alignPropertyWithParent(_propName, _propValue, _data);
      }
   }
};

// Actually update the property value and let all interested parties know
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   var data = (_data) ? _data : { sourceName: this.uName };

   data.propertyOldValue = this.value;
   Source.prototype.updateProperty.call(this, _propName, _propValue, data);

   if (this.parent && this.propogateToParent) {
      this.parent.childPropertyChanged(_propName, _propValue, this, data);
   }
   else {
      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].alignPropertyWithParent(_propName, _propValue, data);
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

Thing.prototype.childPropertyChanged = function(_propName, _propValue, _child, _data) {

   if (this.parent) {
      this.parent.childPropertyChanged(_propName, _propValue, this, _data);
   }
   else {
      this.alignPropertyWithParent(_propName, _propValue, _data);
   }
};

module.exports = exports = Thing;
