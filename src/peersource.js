var util = require('./util');
var AsyncEmitter = require('./asyncemitter');
var Gang = require('./gang');

function PeerSource(_uName, _props, _peerCasa) {
   AsyncEmitter.call(this);

   this.uName = _uName;
   this.peerCasa = _peerCasa;
   this.valid = true;

   this.gang = Gang.mainInstance();

   if (this.gang.findSource(_uName)) {
      this.ghostMode = true;
      console.log(this.uName + ': Creating a ghost peer source as a source with the same name already exists in this local casa.');
   }
   else {
      this.gang.allObjects[this.uName] = this;
   }

   this.props = {};

   for (var prop in _props) {
      this.ensurePropertyExists(prop, 'property', { name: prop });
      this.props[prop].set(_props[prop], {});
   }

   this.peerCasa.addSource(this);
}

util.inherits(PeerSource, AsyncEmitter);

PeerSource.prototype.ensurePropertyExists = function(_propName, _propType, _config) {

   if (!this.props.hasOwnProperty(_propName)) {
      var loadPath =  ((_propType === 'property') || (_propType === 'stateproperty')) ? '' : 'properties/'
      var Prop = require('./' + loadPath + _propType);
      _config.name = _propName;
      _config.type = _propType;
      this.props[_propName]  = new Prop(_config, this);
      return true;
   }
   else {
      return false;
   }
}

// INTERNAL METHOD AND FOR USE BY PROPERTIES
PeerSource.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.ghostMode) {
      let oldValue = this.props[_propName].value;
      this.props[_propName].value = _propValue;
      this.props[_propName].previousValue = oldValue;
      return true;
   }
   else if (this.props.hasOwnProperty(_propName)) {

      if ((!(_data && _data.coldStart)) && (_propValue === this.props[_propName].value)) {
         return true;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.props[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName = this.uName;
      sendData.name = _propName;
      sendData.propertyOldValue = oldValue;
      sendData.value = _propValue;
      sendData.local = true;

      // Call the final hooks
      this.props[_propName].propertyAboutToChange(_propValue, sendData);

      console.info(this.uName + ': Property Changed: ' + _propName + ': ' + _propValue);
      this.props[_propName].value = _propValue;
      this.props[_propName].previousValue = oldValue;
      sendData.alignWithParent = undefined;     // This should never be emitted - only for composite management
      this.asyncEmit('property-changed', sendData);
      return true;
   }
   else {
      return false;
   }
}

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer.');

   let newPropAdded = this.ensurePropertyExists(_data.name, 'property', { name: _data.name });

   // If I am a ghost source (the source also exists in this casa), then tell it. Otherwise, act like I am the source
   if (this.ghostMode) {
      var source = this.gang.findSource(this.uName);

      if (source && source.sourceHasChangedProperty(_data)) {
         this.props[_data.name].set(_data.value, _data);
      }
   }
   else {
      if (newPropAdded) {
         this.props[_data.name].coldStart();
      }
      this.props[_data.name].set(_data.value, _data);
   }
};

PeerSource.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.uName + ': received event-raised event from peer.');

   // If I am a ghost source (the source also exists in this casa), then tell it. Otherwise, act like I am the source
   if (this.ghostMode) {
      var source = this.gang.findSource(this.uName);

      if (source) {
         source.sourceHasRaisedEvent(_data);
      }
   }
   else {
      console.info('Event Raised: ' + this.uName + ':' + _data.name);
      this.asyncEmit('event-raised', util.copy(_data));
   }
};

PeerSource.prototype.isPropertyValid = function(_property) {
   return true;
};

PeerSource.prototype.setProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Attempting to set source property');
   return this.peerCasa.setSourceProperty(this, _propName, _propValue, _data);
};

PeerSource.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ramp');
   return this.peerCasa.setSourcePropertyWithRamp(this, _propName, _ramp, _data);
};

PeerSource.prototype.getProperty = function(_propName) {
   return this.props[_propName].value;
};

PeerSource.prototype.getAllProperties = function(_allProps) {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = this.props[prop].value;
      }
   }
};

PeerSource.prototype.alignPropertyRamp = function(_propName, _rampConfig) {
   this.alignProperties([ { property: _propName, ramp: _rampConfig } ]);
};

PeerSource.prototype.alignPropertyValue = function(_propName, _nextPropValue) {
   this.alignProperties([ { property: _propName, value: _nextPropValue } ]);
};

PeerSource.prototype.alignProperties = function(_properties) {
   console.log(this.uName + ": alignProperties() ", _properties);

   if (_properties && (_properties.length > 0)) {

      for (var i = 0; i < _properties.length; ++i) {

         if (_properties[i].hasOwnProperty('ramp')) {
            this.setPropertyWithRamp(_properties[i].property, _properties[i].ramp, { sourceName: this.uName });
         }
         else {
            this.setProperty(_properties[i].property, _properties[i].value, { sourceName: this.uName });
         }
      }
   }
};

PeerSource.prototype.coldStart = function() {

   if (!this.ghostMode) {

      for (var prop in this.props) {

         if (this.props.hasOwnProperty(prop)) {
            var sendData = {};
            sendData.sourceName = this.uName;
            sendData.name = prop;
            sendData.value = this.props[prop].value;
            sendData.coldStart = true;
            console.info(this.uName + ': Property Changed: ' + prop + ': ' + sendData.value);
            this.asyncEmit('property-changed', util.copy(sendData));
         }
      }
   }
}

PeerSource.prototype.invalidate = function() {

   if (!this.ghostMode) {
      this.valid = false;

      for(var prop in this.props) {

         if (this.props.hasOwnProperty(prop)) {
            this.asyncEmit('invalid', { sourceName: this.uName, name: prop });
         }
      }

      delete this.peerCasa.gang.allObjects[this.uName];
      this.peerCasa.updateAllGhosts(this.uName);
   }
};

PeerSource.prototype.isActive = function() {
   return this.props['ACTIVE'].value;
};

PeerSource.prototype.endGhostMode = function() {
   console.log(this.uName + ": Ending ghost mode and becoming main source in casa (peercasa)");
   this.ghostMode = false;
   this.gang.allObjects[this.uName] = this;
};

module.exports = exports = PeerSource;

