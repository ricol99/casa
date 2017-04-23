var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');
var Property = require('./property');

function Source(_config) {
   this.uName = _config.name;
   this.valid = true;

   this.setMaxListeners(50);

   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   if (_config.secureConfig) {
      this.secureConfig = this.casaSys.loadSecureConfig(this.uName, _config);
   }

   this.props = { ACTIVE: new Property({ name: 'ACTIVE', type: 'property', initialValue: false }, this) };

   if (_config.props) {
      var propLen = _config.props.length;

      for (var i = 0; i < propLen; ++i) {
         var Prop = Property;

         if (_config.props[i].type == undefined) {
            _config.props[i].type = 'property';
         }
         else {
            Prop = require('./properties/'+_config.props[i].type);
         }

         this.props[_config.props[i].name] = new Prop(_config.props[i], this);
      }
   }

   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   events.EventEmitter.call(this);

   if (this.casa) {
      console.log(this.uName + ': Source casa: ' + this.casa.uName);
      this.casa.addSource(this);
   }
}

util.inherits(Source, events.EventEmitter);

Source.prototype.isActive = function() {
   return this.props['ACTIVE'].value;
}

Source.prototype.isPropertyValid = function(_property) {

   if (this.props[_property] != undefined) {
      return this.props[_property].valid;
   }
   else {
      return true;
   }
}

Source.prototype.getProperty = function(_property) {
   return (this.props.hasOwnProperty(_property)) ? this.props[_property].value : undefined;
}

Source.prototype.setProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ' + _propValue);

   if (this.props.hasOwnProperty(_propName)) {
      return this.props[_propName].set(_propValue, _data);
   }
   else {
      return false;
   } 
}

Source.prototype.getAllProperties = function(_allProps) {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = this.props[prop].value;
      }
   }
};


// Only called by ghost peer source
Source.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer (duplicate) source');

   var prop = this.props[_data.propertyName];

   // Only update if the property has a different value
   if (prop && (prop.value != _data.propertyValue)) {

      // Only update if the property has no processing attached to it
      if (prop.type === 'property' && !prop.pipeline && !prop.hasSourceOutputValues) {
         return prop.set(_data.propertyValue, _data);
      }
   }
   return false;
}

// Override this for last output hook - e.g. sync and external property with the final property value
Source.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
};

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
Source.prototype.emitPropertyChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Emitting Property Change (Child) ' + _propName + ' is ' + _propValue);
   console.info('Child Property Changed: ' + this.uName + ':' + _propName + ': ' + _propValue);

   var sendData = (_data) ? copyData(_data) : {};
   sendData.sourceName = this.uName;
   sendData.propertyName = _propName;
   sendData.propertyValue = _propValue;
   sendData.local = this.local;
   this.emit('property-changed', sendData);
};

Source.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.props.hasOwnProperty(_propName)) {

      if (!(_data && _data.coldStart) && (_propValue === this.props[_propName].value)) {
         return;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);


      var oldValue = this.props[_propName].value;
      var sendData = (_data) ? copyData(_data) : {};
      sendData.sourceName = this.uName;
      sendData.propertyName = _propName;
      sendData.propertyOldValue = oldValue;
      sendData.propertyValue = _propValue;

      if (this.hasOwnProperty('local')) {
         sendData.local = this.local;
      }

      // Call the final hook
      this.propertyAboutToChange(_propName, _propValue, sendData);

      console.info('Property Changed: ' + this.uName + ':' + _propName + ': ' + _propValue);
      this.props[_propName].value = _propValue;
      this.props[_propName].previousValue = oldValue;
      sendData.alignWithParent = undefined;	// This should never be emitted - only for composite management
      this.emit('property-changed', sendData);
      return true;
   }
   else {
      return false;
   }
}

Source.prototype.propertyOutputStepsComplete = function(_propName, _propValue, _previousPropValue, _data) {
   // Do nothing by default
};

Source.prototype.setNextPropertyValue = function(_propName, _nextPropValue) {

   setTimeout(function(_this, _nextValue) {     // Don't allow night mode, ignore and set target state back to old value
      _this.updateProperty(_propName, _nextValue);
   }, 100, this, _nextPropValue);

};

Source.prototype.rejectPropertyUpdate = function(_propName) {
   this.setNextPropertyValue(_propName, this.props[_propName].value);
};

Source.prototype.ensurePropertyExists = function(_propName, _propType, _config) {

   if (!this.props.hasOwnProperty(_propName)) {
     var loadPath =  (_propType === 'property') ? '' : 'properties/'
     var Property = require('./' + loadPath + _propType);
     _config.name = _propName;
     _config.type = _propType;
     this.props[_propName]  = new Property(_config, this);
   }
};

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
   console.log(this.uName + ": Going invalid! Previously active state=" + this.props['ACTIVE'].value);

   var sendData = _sourceData;
   sendData.sourceName = this.uName;
   sendData.oldState = this.props['ACTIVE'].value;
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
 
