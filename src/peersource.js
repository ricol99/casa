var util = require('./util');
var SourceBase = require('./sourcebase');
var Gang = require('./gang');

function PeerSource(_config, _owner) {
   _config.transient = true;
   _config.fromPeer = true;
   SourceBase.call(this, _config, _owner);

   this.priority = (_config.hasOwnProperty('priority')) ? _config.priority : 0;
   this.bowing = true;
}

util.inherits(PeerSource, SourceBase);

PeerSource.prototype.export = function(_exportObj) {
   SourceBase.prototype.export.call(this, _exportObj);
   _exportObj.type = this.type;
   _exportObj.priority = this.priority;
   _exportObj.fromPeer = this.fromPeer;
};

PeerSource.prototype.addToMainTree = function() {
   var existingSource = this.gang.findNamedObject(this.uName);

   if (existingSource) {

      if (existingSource.deferToPeer(this)) {
         this.standUpFromBow();
         return true;
      }
   }
   else {
      this.standUpFromBow();
   }

   return false;
};

PeerSource.prototype.subscriptionRegistered = function(_event, _subscription) {
   console.log(this.uName+": subscriptionRegistered() :" + _event);
   this.casa.subscriptionRegistered(this, _event, _subscription);
};

PeerSource.prototype.subscriptionRemoved = function(_event, _subscription) {
   console.log(this.uName+": subscriptionRemoved() :" + _event);
   this.casa.subscriptionRemoved(this, _event, _subscription);
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
      sendData.fromPeer = true;

      if (sendData.hasOwnProperty("transaction")) {
         this.setTransaction(sendData.transaction);
      }
      else {
         sendData.transaction = this.checkTransaction();
      }

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

PeerSource.prototype.newTransaction = function() {
   SourceBase.prototype.newTransaction.call(this);

   this.casa.setSourceTransaction(this, this.currentTransaction, { transaction: this.currentTransaction });
   return this.currentTransaction;
};

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
