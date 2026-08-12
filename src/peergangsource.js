var util = require('./util');
var SourceBase = require('./sourcebase');

function PeerGangSource(_config, _owner) {
   _config.transient = true;
   _config.fromPeer = true;
   _config.type = "peergangsource";

   SourceBase.call(this, _config, _owner);

   this.peerGang = this.findPeerGangOwner();
}

util.inherits(PeerGangSource, SourceBase);

PeerGangSource.prototype.findPeerGangOwner = function() {
   var owner = this.owner;

   while (owner && !((typeof owner.superType === "function") && (owner.superType() === "peergang"))) {
      owner = owner.owner;
   }

   return owner;
};

PeerGangSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer gang.');

   let newPropAdded = this.ensurePropertyExists(_data.name, 'property', { name: _data.name, valueType: _data.valueType });

   if (newPropAdded) {
      this.properties[_data.name].coldStart();
   }

   this.properties[_data.name].set(_data.value, _data);
};

PeerGangSource.prototype.sourceHasRaisedEvent = function(_data) {
   console.log(this.uName + ': received event-raised event from peer gang.');
   this.ensureEventExists(_data.name, 'event', { name: _data.name });
   this.asyncEmit('event-raised', util.copy(_data));
};

PeerGangSource.prototype.setProperty = function(_propName, _propValue, _data) {
   return this.peerGang.setSourceProperty(this, _propName, _propValue, _data);
};

PeerGangSource.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   return this.peerGang.setSourcePropertyWithRamp(this, _propName, _ramp, _data);
};

PeerGangSource.prototype.raiseEvent = function(_eventName, _data) {
   return this.peerGang.raiseSourceEvent(this, _eventName, _data);
};

module.exports = exports = PeerGangSource;
