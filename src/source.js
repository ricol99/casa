var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Source(_config) {
   this.name = _config.name;
   this.sourceEnabled = true;
   this.props = { ACTIVE: false };
   this.propBinders = { ACTIVE: null };
   this.setMaxListeners(50);

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.casa;

   if (_config.props) {
      var propLen = _config.props.length;

      for (var i = 0; i < propLen; ++i) {
         this.props[_config.props[i].name] = _config.props[i].initialValue;

         if (_config.props[i].binder) {
            var PropertyBinder = casaSys.cleverRequire(_config.props[i].binder.name);

            if (PropertyBinder) {
               _config.props[i].binder.propertyName = _config.props[i].name;
               _config.props[i].binder.writable = (_config.props[i].writeable) ? _config.props[i].writeable : true;
               this.propBinders[_config.props[i].name] = new PropertyBinder(_config.props[i].binder, this);
            }
         }
      }
   }

   this.applyProps = {};
   this.applyProps.active = (_config.applyProps) ? ((_config.applyProps.active) ? _config.applyProps.active : null) : null;
   this.applyProps.inactive = (_config.applyProps) ? ((_config.applyProps.inactive) ? _config.applyProps.inactive : null) : null;
   this.writable = (_config.writable) ? _config.writable : true;

   events.EventEmitter.call(this);

   if (this.casa) {
      console.log(this.name + ': Source casa: ' + this.casa.name);
      this.casa.addSource(this);
   }

   var that = this;
}

util.inherits(Source, events.EventEmitter);

Source.prototype.isPropertyEnabled = function(_property) {

   if (this.propBinders[_property]) {
      return this.propBinders[_property].binderEnabled;
   }
   else {
      return true;
   }
}

Source.prototype.getProperty = function(_property) {
   return this.props[_property];
}

Source.prototype.setProperty = function(_propName, _propValue, _data, _callback) {
   console.log(this.name + ': Attempting to set Property ' + _propName + ' to ' + _propValue);

   if (this.props[_propName] != _propValue) {

      if (this.propBinders[_propName]) {

         if (this.propBinders[_propName].writeable) {
            this.propBinders[_propName].setProperty(_propValue, _data, _callback);
         }
         else {
            console.log(this.name + ': Uanble to set property because it is read only!');
            _callback(false);
         }
      }
      else {
         this.updateProperty(_propName, _propValue, _data);
         _callback(true);
      }
   }
   else {
      _callback(true);
   }
}


// INTERNAL METHOD AND FOR USE BY PROPERTY BINDERS
Source.prototype.updateProperty = function(_propName, _propValue, _data) {
   console.log(this.name + ': Setting Property ' + _propName + ' to ' + _propValue);
   console.info('Property Changed: ' + this.name + ':' + _propName + ': ' + _propValue);
   var oldValue = this.props[_propName];
   this.props[_propName] = _propValue;
   var sendData = (_data) ? this.copyData(_data) : {};
   sendData.sourceName = this.name;
   sendData.propertyName = _propName;
   sendData.propertyOldValue = oldValue;
   sendData.propertyValue = _propValue;
   this.emit('property-changed', sendData);
}

Source.prototype.isActive = function() {
   return this.props['ACTIVE'];
}

Source.prototype.setActive = function(_data, _callback) {
   this.setProperty('ACTIVE', true, _data, _callback);
}

Source.prototype.setInactive = function(_data, _callback) {
   this.setProperty('ACTIVE', false, _data, _callback);
}

Source.prototype.copyData = function(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

Source.prototype.mergeActiveApplyProps = function(_sourceData) {
   var dataToSend = this.copyData(_sourceData);

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
   var dataToSend = this.copyData(_sourceData);

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
   console.log(this.name + ": Going active! Previously active state=" + this.props['ACTIVE']);

   var sendData = this.mergeActiveApplyProps(_sourceData);
   sendData.sourceName = this.name;
   sendData.oldState = this.props['ACTIVE'];
   console.log(this.name+": Data=", sendData);
   this.updateProperty('ACTIVE', true, sendData);
}

Source.prototype.goInactive = function(_sourceData) {
   console.log(this.name + ": Going inactive! Previously active state=" + this.props['ACTIVE']);

   var sendData = this.mergeInactiveApplyProps(_sourceData);
   sendData.sourceName = this.name;
   sendData.oldState = this.props['ACTIVE'];
   this.updateProperty('ACTIVE', false, sendData);
}

Source.prototype.goInvalid = function(_propName, _sourceData) {
   console.log(this.name + ": Going invalid! Previously active state=" + this.props['ACTIVE']);

   var sendData = _sourceData;
   sendData.sourceName = this.name;
   sendData.oldState = this.props['ACTIVE'];
   this.props['ACTIVE'] = false;
   sendData.propertyName = _propName;
   console.log(this.name + ": Emitting invalid! send data=", sendData);
   this.emit('invalid', sendData);
}

Source.prototype.coldStart = function() {

   for(var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {

         if (this.propBinders[prop]) {
            this.propBinders[prop].coldStart();
         }
         else {
            var sendData = {};
            sendData.sourceName = this.name;
            sendData.propertyName = prop;
            sendData.propertyValue = this.props[prop];
            sendData.coldStart = true;
            this.emit('property-changed', sendData);
         }
      }
   }
}


module.exports = exports = Source;
 
