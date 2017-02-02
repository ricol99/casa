var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');
var Property = require('./property');

function Source(_config) {
   this.uName = _config.name;
   this.sourceEnabled = true;

   this.setMaxListeners(50);

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.casa;

   this.props = { ACTIVE: new Property({ name: 'ACTIVE', type: 'property', owner: this, initialValue: false }) };

   if (_config.props) {
      var propLen = _config.props.length;

      for (var i = 0; i < propLen; ++i) {
         var Prop = Property;

         if ((_config.props[i].type == undefined) {
            _config.props[i].type = 'property');
            Prop = require('./'+_config.props[i].type);
         }

         this.props[_config.props[i].name] = new Prop(_config.props[i]);
      }
   }

   events.EventEmitter.call(this);

   if (this.casa) {
      console.log(this.uName + ': Source casa: ' + this.casa.uName);
      this.casa.addSource(this);
   }
}

util.inherits(Source, events.EventEmitter);

Source.prototype.isActive = function() {
   return this.props['ACTIVE'];
}

Source.prototype.isPropertyEnabled = function(_property) {

   if (this.propBinders[_property]) {
      return this.propBinders[_property].enabled;
   }
   else {
      return true;
   }
}

Source.prototype.getProperty = function(_property) {
   return this.props[_property].value;
}

Source.prototype.setProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ' + _propValue);

   if (this.props[_propName] != undefined) {
      return this.props[_propName].setProperty(_propValue, _data);
   }
   else {
      return false;
   } 
}

// Only called by ghost peer source
Source.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer (duplicate) source');

   var prop = this.props[_data.propertyName];

   // Only update if the property has a different value
   if (prop && (prop.value != _data.propertyValue)) {

      // Only update if the property has no processing attached to it
      if (prop.type === 'property' && !prop.stepPipeline && !prop.hasSourceOutputValues);
         return prop.setProperty(_data.propertyValue, _data);
      }
   }
   return false;
}

// Override this for last output hook - e.g. sync and external property with the final property value
Source.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
};

// INTERNAL METHOD AND FOR USE BY PROPERTY BINDERS
Source.prototype.updateProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);
   console.info('Property Changed: ' + this.uName + ':' + _propName + ': ' + _propValue);

   // Call the final hook
   this.propertyAboutToChange(_propName, _propValue, _data);

   var oldValue = this.props[_propName];
   this.props[_propName].value = _propValue;
   var sendData = (_data) ? copyData(_data) : {};
   sendData.sourceName = this.uName;
   sendData.propertyName = _propName;
   sendData.propertyOldValue = oldValue;
   sendData.propertyValue = _propValue;
   this.emit('property-changed', sendData);
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

Source.prototype.goInvalid = function(_propName, _sourceData) {
   console.log(this.uName + ": Going invalid! Previously active state=" + this.props['ACTIVE']);

   var sendData = _sourceData;
   sendData.sourceName = this.uName;
   sendData.oldState = this.props['ACTIVE'];
   this.props['ACTIVE'].value = false;	// XXX TODO Should this be setProperty()?
   sendData.propertyName = _propName;
   console.log(this.uName + ": Emitting invalid!");
   this.emit('invalid', sendData);
}

Source.prototype.coldStart = function() {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.props[prop].coldStart();
      }
   }
}


module.exports = exports = Source;
 
