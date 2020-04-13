var util = require('./util');
var SourceBase = require('./sourcebase');
var Gang = require('./gang');

function PeerSource(_uName, _priority, _props, _peerCasa) {
   SourceBase.call(this, _uName, Gang.mainInstance());

   this.priority = _priority;
   this.casa = _peerCasa;

   this.config = { local: true };
   this.local = true;

   var existingSource = this.gang.findGlobalSource(_uName);

   if (existingSource) {

      if (existingSource.deferToPeer(this)) {
         this.gang.allObjects[this.uName] = this;
      }
      else {
         this.bowToOtherSource();
      }
   }
   else {
      this.gang.allObjects[this.uName] = this;
   }

   for (var prop in _props) {
      this.ensurePropertyExists(prop, 'property', { name: prop });
      this.props[prop].set(_props[prop], {});
   }

   this.casa.addSource(this);
}

util.inherits(PeerSource, SourceBase);

// INTERNAL METHOD AND FOR USE BY PROPERTIES
PeerSource.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.props.hasOwnProperty(_propName)) {

      if ((!(_data && _data.coldStart)) && (_propValue === this.props[_propName].value)) {
         return true;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.props[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName = "::"+this.uName;
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

PeerSource.prototype.setProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Attempting to set source property');
   return this.casa.setSourceProperty(this, _propName, _propValue, _data);
};

PeerSource.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ramp');
   return this.casa.setSourcePropertyWithRamp(this, _propName, _ramp, _data);
};

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer.');

   let newPropAdded = this.ensurePropertyExists(_data.name, 'property', { name: _data.name });

   if (newPropAdded) {
      this.props[_data.name].coldStart();
   }
   this.props[_data.name].set(_data.value, _data);
};

PeerSource.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.uName + ': received event-raised event from peer.');
   console.info('Event Raised: ' + this.uName + ':' + _data.name);
   this.asyncEmit('event-raised', util.copy(_data));
};

PeerSource.prototype.invalidate = function() {
   SourceBase.prototype.invalidate.call(this);
   delete this.gang.allObjects[this.uName];
   this.casa.findNewMainSource(this);
};

module.exports = exports = PeerSource;

