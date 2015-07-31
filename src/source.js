var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Source(_config) {
   this.name = _config.name;
   this.active = false;
   this.sourceEnabled = true;
   this.props = (_config.props) ? _config.props : {};
   this.applyProps = {};
   this.applyProps.active = (_config.applyProps) ? ((_config.applyProps.active) ? _config.applyProps.active : null) : null;
   this.applyProps.inactive = (_config.applyProps) ? ((_config.applyProps.inactive) ? _config.applyProps.inactive : null) : null;
   this.writable = (_config.writable) ? _config.writable : true;

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

   if (this.casa) {
      console.log(this.name + ': Source casa: ' + this.casa.name);
      this.casa.addSource(this);
   }

   var that = this;
}

util.inherits(Source, events.EventEmitter);

Source.prototype.refreshSources = function() {
   // Do Nothing
}

Source.prototype.getProperty = function(_property) {
   return (_property == 'ACTIVE') ? this.isActive() : this.props[_property];
}

Source.prototype.setProperty = function(_propName, _propValue, _callback) {

   if (this.writable) {
      console.log(this.name + ': Attempting to set Property ' + _propName + ' to ' + _propValue);
      var oldValue = this.props[_propName];
      this.props[_propName] = _propValue;
      this.emit('property-changed', { sourceName: this.name, propertyName: _propName, propertyOldValue: oldValue, propertyValue: _propValue });
      _callback(true);
   }
   else {
      console.log(this.name + ': Source is read only!');
      _callback(false);
   }
}

Source.prototype.isActive = function() {
   return this.active;
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

Source.prototype.mergeActiveApplyProps = function(_sourceData) {
   var dataToSend = _sourceData;

   if (dataToSend) {

      if (this.applyProps.active) {

         if (!dataToSend.applyProps) { dataToSend.applyProps = {}; }
         for (var attrname in this.applyProps.active) { dataToSend.applyProps[attrname] = this.applyProps.active[attrname]; }
      }
   }
   else {
      dataToSend.applyProps = this.applyProps.active;
   }
   return dataToSend;
}

Source.prototype.mergeInactiveApplyProps = function(_sourceData) {
   var dataToSend = _sourceData;

   if (dataToSend) {
      if (this.applyProps.inactive) {

         if (!dataToSend.applyProps) { dataToSend.applyProps = {}; }
         for (var attrname in this.applyProps.inactive) { dataToSend.applyProps[attrname] = this.applyProps.inactive[attrname]; }
      }
   }
   else {
      dataToSend = {};
      dataToSend.applyProps = this.applyProps.inactive;
   }
   return dataToSend;
}

Source.prototype.goActive = function(_sourceData) {
   console.log(this.name + ": Going active! Previously active state=" + this.active);

   var sendData = this.mergeActiveApplyProps(_sourceData);
   sendData.sourceName = this.name;
   sendData.oldState = this.active;
   this.active = true;
   console.log(this.name + ": Emitting active! send data=", sendData);
   this.emit('active', sendData);
}

Source.prototype.goInactive = function(_sourceData) {
   console.log(this.name + ": Going inactive! Previously active state=" + this.active);

   var sendData = this.mergeInactiveApplyProps(_sourceData);
   sendData.sourceName = this.name;
   sendData.oldState = this.active;
   this.active = false;
   console.log(this.name + ": Emitting inactive! send data=", sendData);
   this.emit('inactive', sendData);
}

Source.prototype.goInvalid = function(_sourceData) {
   console.log(this.name + ": Going invalid! Previously active state=" + this.active);

   var sendData = _sourceData;
   sendData.sourceName = this.name;
   sendData.oldState = this.active;
   this.active = false;
   console.log(this.name + ": Emitting invalid! send data=", sendData);
   this.emit('invalid', sendData);
}

Source.prototype.coldStart = function() {
   // ** DO NOTHING BY DEFAULT - Only States are cold started
}


module.exports = exports = Source;
 
