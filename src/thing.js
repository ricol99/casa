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

// Actually update the property value and let all interested parties know
// Also used to navigate down the composite thing tree to update a property shared by all
Thing.prototype.updateProperty = function(_propName, _propValue, _data) {
   var data = (_data) ? _data : { sourceName: this.uName };

   if (data.alignWithParent) {

      if (this.props[_propName]) {

         if (data.enterManualMode) {
            this.props[_propName].setManualMode(true); // XXXX TODO Is this the right thing to do - who controls the timers?
         }
         else if (data.leaveManualMode) {
            this.props[_propName].setManualMode(false); // XXXX TODO Is this the right thing to do - who controls the timers?
         }
      }

      if (!Source.prototype.updateProperty.call(this, _propName, _propValue, _data)) {
         this.emitPropertyChange(_propName, _propValue, data);
      }

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].updateProperty(_propName, _propValue, data);
         }
      }
   }
   else {
      data.propertyOldValue = this.value;
      Source.prototype.updateProperty.call(this, _propName, _propValue, _data);

      if (this.parent && this.propogateToParent) {
         this.parent.childPropertyChanged(_propName, _propValue, this, data);
      }
      else {
         data.alignWithParent = true;

         for (var thing in this.things) {

            if (this.things.hasOwnProperty(thing)) {
               this.things[thing].updateProperty(_propName, _propValue, data);
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

   if (_data.alignWithParent) {
      Source.prototype.raiseEvent.call(this, _eventName, _data);

      for (var thing in this.things) {

         if (this.things.hasOwnProperty(thing)) {
            this.things[thing].raiseEvent(_eventName, _data);
         }
      }
   }
   else {
      this.childRaisedEvent(_eventName, this, _data);
   }
};

function copyData(_sourceData) {

   if (_sourceData) {
      var newData = {};

      for (var prop in _sourceData) {

         if (_sourceData.hasOwnProperty(prop)){
            newData[prop] = _sourceData[prop];
         }
      }

      return newData;
   }
   else {
      return undefined;
   }
}

module.exports = exports = Thing;
