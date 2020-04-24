var util = require('./util');
var SourceBase = require('./sourcebase');
var Gang = require('./gang');

function PeerSource(_fullName, _uName, _priority, _props, _peerCasa) {
   var gang = Gang.mainInstance();
   var bowingOwner = _peerCasa.getBowingSource(_fullName.replace(":"+_uName));

   var existingSource = gang.findNamedObject(_fullName);
   var owner = bowingOwner ? bowingOwner : existingSource ? _fullName : gang.findOwner(_fullName);

   SourceBase.call(this, _uName, owner);

   this.priority = _priority;
   this.casa = _peerCasa;

   this.config = { local: true };
   this.local = true;

   if (bowingOwner) {
      this.bowToOtherSource(false, false);
   }
   else if (existingSource) {

      if (existingSource.deferToPeer(this)) {
         this.standUpFromBow();
      }
      else {
         this.bowToOtherSource(false, true);
      }
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

      console.log(this.fullName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.props[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName = "::"+this.fullName;
      sendData.name = _propName;
      sendData.propertyOldValue = oldValue;
      sendData.value = _propValue;
      sendData.local = true;

      // Call the final hooks
      this.props[_propName].propertyAboutToChange(_propValue, sendData);

      console.info(this.fullName + ': Property Changed: ' + _propName + ': ' + _propValue);
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
   console.log(this.fullName + ': Attempting to set source property');
   return this.casa.setSourceProperty(this, _propName, _propValue, _data);
};

PeerSource.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   console.log(this.fullName + ': Attempting to set Property ' + _propName + ' to ramp');
   return this.casa.setSourcePropertyWithRamp(this, _propName, _ramp, _data);
};

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.fullName + ': received changed-property event from peer.');

   let newPropAdded = this.ensurePropertyExists(_data.name, 'property', { name: _data.name });

   if (newPropAdded) {
      this.props[_data.name].coldStart();
   }
   this.props[_data.name].set(_data.value, _data);
};

PeerSource.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.fullName + ': received event-raised event from peer.');
   console.info('Event Raised: ' + this.fullName + ':' + _data.name);
   this.asyncEmit('event-raised', util.copy(_data));
};

PeerSource.prototype.findNewMainSource = function() {

   if (!this.bowing) {
      this.bowToOtherSource(false, false);
      this.casa.findNewMainSource(this);
   }
};

module.exports = exports = PeerSource;

