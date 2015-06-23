var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Source(_config) {
   this.name = _config.name;
   this.active = false;
   this.sourceEnabled = true;
   this.props = (_config.props) ? _config.props : [];

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.casa;

   if (_config.thing) {
      var thing = casaSys.findSource(_config.thing);

      if (thing && thing != this) {
         this.thing = thing;
         this.thing.addSource(this);
      }
   }

   events.EventEmitter.call(this);

   var that = this;
}

util.inherits(Source, events.EventEmitter);

// Override this function if you want to support writable properties
Source.prototype.setProperty = function(_propName, _propValue, _callback) {
   console.log(this.name + ': Source is read only!');
   _callback(false);
}

// Override these two functions if you want to support writable states
Source.prototype.setActive = function(_callback) {
   console.log(this.name + ': Source is read only!');
   _callback(false);
}

Source.prototype.setInactive = function(_callback) {
   console.log(this.name + ': Source is read only!');
   _callback(false);
}

Source.prototype.getProperty = function(_property) {
   return (_property == 'ACTIVE') ? this.isActive() : this.props[_property];
}

Source.prototype.isActive = function() {
   return this.active;
}

Source.prototype.changePropertyAndEmit = function(_propName, _propValue, _callback) {
   var oldValue = this.props[_propName];
   this.props[_propName] = _propValue;
   this.emit('property-changed', { sourceName: this.name, propertyName: _propName, propertyOldValue: oldValue, propertyValue: _propValue });
   _callback(true);
}

module.exports = exports = Source;
 
