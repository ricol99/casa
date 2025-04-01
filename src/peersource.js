var util = require('./util');
var SourceBase = require('./sourcebase');
var Gang = require('./gang');

function PeerSource(_uName, _name, _priority, _properties, _peerCasa) {
   var gang = Gang.mainInstance();
   var bowingOwner = _peerCasa.getBowingSource(_uName.replace(":"+_name));

   var existingSource = gang.findNamedObject(_uName);
   var owner = bowingOwner ? bowingOwner : existingSource ? _uName : gang.findOwner(_uName);

   SourceBase.call(this, { name: _name, type: "peersource", transient: true, local: true }, owner);

   this.priority = _priority;
   this.casa = _peerCasa;

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

   for (var prop in _properties) {
      this.ensurePropertyExists(prop, 'property', { name: prop, cold: false });
      this.properties[prop].set(_properties[prop], {});
   }

   this.casa.addSource(this);
}

util.inherits(PeerSource, SourceBase);

PeerSource.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {

   if (_subscription.hasOwnProperty("mirror")) {
      console.log(this.uName+": propertySubscribedTo() mirror, sub=",_subscription);
   }
   else {
      console.log(this.uName+": propertySubscribedTo() prop="+_property+", sub=",_subscription);
   }

   this.casa.propertySubscribedTo(this, _property, _subscription, _exists);
};

// Something wants to watch (and possibly raise towards) several events in this service node (read) - called from sourcelistener
PeerSource.prototype.eventSubscribedTo = function(_eventName, _subscription) {
   console.log(this.uName+": eventSubscribedTo() event="+_eventName+", sub=",_subscription);
   this.casa.eventSubscribedTo(this, _eventName, _subscription);
};

// Something does not want to watch a property anymore - called from sourcelistener
PeerSource.prototype.propertySubscriptionRemoval = function(_property, _subscription, _exists) {

   if (_subscription.hasOwnProperty("mirror")) {
      console.log(this.uName+": propertySubscriptionRemoval() mirror, sub=",_subscription);
   }
   else {
      console.log(this.uName+": propertySubscriptionRemoval() prop="+_property+", sub=",_subscription);
   }

   this.casa.propertySubscriptionRemoval(this, _property, _subscription, _exists);
};

// Something does not want to watch an event anymore - called from sourcelistener
PeerSource.prototype.eventSubscriptionRemoval = function(_eventName, _subscription) {
   console.log(this.uName+": eventSubscriptionRemoval() event="+_eventName+", sub=",_subscription);
   this.casa.eventSubscriptionRemoval(this, _eventName, _subscription);
};


PeerSource.prototype.interestInNewChild = function(_uName) {
   this.casa.interestInNewChild(this, _uName);
};


// INTERNAL METHOD AND FOR USE BY PROPERTIES
PeerSource.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (this.properties.hasOwnProperty(_propName)) {

      if ((!(_data && _data.coldStart)) && (_propValue === this.properties[_propName].value)) {
         return _propValue;
      }

      console.log(this.uName + ': Setting Property ' + _propName + ' to ' + _propValue);

      var oldValue = this.properties[_propName].value;
      var sendData = (_data) ? util.copy(_data) : {};
      sendData.sourceName = this.uName;
      sendData.name = _propName;
      sendData.propertyOldValue = oldValue;
      sendData.value = _propValue;
      sendData.local = true;
      sendData.transaction = this.checkTransaction();

      // Call the final hooks
      var newPropValue = this.properties[_propName].propertyAboutToChange(_propValue, sendData);

      console.info(this.uName + ': Property Changed: ' + _propName + ': ' + newPropValue, this.bowing ? "(BOWING)" : "");
      this.properties[_propName].value = newPropValue;
      sendData.value = newPropValue;
      this.properties[_propName].previousValue = oldValue;
      delete sendData.alignWithParent;	// This should never be emitted - only for composite management
      this.asyncEmit('property-changed', sendData);
      return newPropValue;
   }
   else {
      return _propValue;
   }
}

PeerSource.prototype.setProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Attempting to set source property');

   var data = _data ? util.copy(_data) : {};

   if (!data.hasOwnProperty("transaction")) {
      data.transaction = this.checkTransaction();
   }
   return this.casa.setSourceProperty(this, _propName, _propValue, data);
};

PeerSource.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   console.log(this.uName + ': Attempting to set Property ' + _propName + ' to ramp');

   var data = _data ? util.copy(_data) : {};

   if (!data.hasOwnProperty("transaction")) {
      data.transaction = this.checkTransaction();
   }

   return this.casa.setSourcePropertyWithRamp(this, _propName, _ramp, data);
};

PeerSource.prototype.raiseEvent = function(_eventName, _data) {
   console.log(this.uName + ': Attempting to raise Event ' + _eventName);

   var data = _data ? util.copy(_data) : {};

   if (!data.hasOwnProperty("transaction")) {
      data.transaction = this.checkTransaction();
   }

   return this.casa.raiseSourceEvent(this, _eventName, data);
};

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer.');

   let newPropAdded = this.ensurePropertyExists(_data.name, 'property', { name: _data.name });

   if (newPropAdded) {
      this.properties[_data.name].coldStart();
   }
   this.properties[_data.name].set(_data.value, _data);
};

PeerSource.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.uName + ': received event-raised event from peer.');
   console.info('Event Raised: ' + this.uName + ':' + _data.name);
   this.asyncEmit('event-raised', util.copy(_data));
};

PeerSource.prototype.findNewMainSource = function() {

   if (!this.bowing) {
      var uName = this.uName;
      this.bowToOtherSource(true, this.casa.topSources.hasOwnProperty(uName));
      this.casa.findNewMainSource(uName);
   }
};

module.exports = exports = PeerSource;

