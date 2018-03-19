var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function PeerSource(_uName, _props, _peerCasa) {
   this.uName = _uName;
   this.peerCasa = _peerCasa;
   this.valid = true;

   var casaSys = CasaSystem.mainInstance();
   var source = casaSys.findSource(_uName);

   if (source) {
      this.ghostMode = true;
      this.myRealSource = source;
      console.log(this.uName + ': Creating a ghost peer source as a source with the same name already exists in this local casa.');
   }
   else {
      casaSys.allObjects[this.uName] = this;
   }

   this.props = {};

   for (var prop in _props) {

      if (_props.hasOwnProperty(prop)){
         this.props[prop] = { value: _props[prop] };
      }
   }

   events.EventEmitter.call(this);
   this.peerCasa.addSource(this);
}

util.inherits(PeerSource, events.EventEmitter);

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer.');

   // If I am a ghost source (the source also exists in this casa), then tell it. Otherwise, act like I am the source
   if (this.ghostMode) {

      if (this.myRealSource.sourceHasChangedProperty(_data)) {
         this.props[_data.name] = { value: _data.value };
      }
   }
   else {
      console.info(this.uName + ': Property Changed: ' + _data.name + ': ' + _data.value);
      this.props[_data.name] = { value: _data.value };
      this.emit('property-changed', copyData(_data));
   }
};

PeerSource.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.uName + ': received event-raised event from peer.');

   // If I am a ghost source (the source also exists in this casa), then tell it. Otherwise, act like I am the source
   if (this.ghostMode) {
      this.myRealSource.sourceHasRaisedEvent(_data);
   }
   else {
      console.info('Event Raised: ' + this.uName + ':' + _data.uName);
      this.emit('event-raised', copyData(_data));
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
            this.emit('property-changed', copyData(sendData));
         }
      }
   }
}

PeerSource.prototype.invalidateSource = function() {

   if (!this.ghostMode) {
      this.valid = false;

      for(var prop in this.props) {

         if (this.props.hasOwnProperty(prop)) {
            this.emit('invalid', { sourceName: this.uName, name: prop });
         }
      }

      delete this.peerCasa.casaSys.allObjects[this.uName];
   }
};

PeerSource.prototype.isActive = function() {
   return this.props['ACTIVE'].value;
};

module.exports = exports = PeerSource;

