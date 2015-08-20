var util = require('util');
var events = require('events');
var S = require('string');

function PeerSource(_name, _props, _peerCasa) {
   this.name = _name;
   this.props = _props;
   this.peerCasa = _peerCasa;
   this.sourceEnabled = true;
   
   events.EventEmitter.call(this);

   var that = this;

   this.peerCasa.addSource(this);
}

util.inherits(PeerSource, events.EventEmitter);

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.name + ': received changed-property event from peer.');
   this.props[_data.propertyName] = _data.propertyValue;
   this.emit('property-changed', _data);
}

PeerSource.prototype.setActive = function(_callback) {
   console.log(this.name + ': Attempting to set source to active');
   this.peerCasa.setSourceActive(this, _callback);
}

PeerSource.prototype.setInactive = function(_callback) {
   console.log(this.name + ': Attempting to set source to inactive');
   this.peerCasa.setSourceInactive(this, _callback);
}

PeerSource.prototype.setProperty = function(_propName, _propValue, _callback) {
   console.log(this.name + ': Attempting to set source property');
   this.peerCasa.setSourceProperty(this, _propName, _propValue, _callback);
}

PeerSource.prototype.getProperty = function(_propName) {
   return this.props[_propName];
}

PeerSource.prototype.coldStart = function() {

   if (this.props['ACTIVE']) {
      this.emit('active', { sourceName: this.name, coldStart: true });
   }
   else {
      this.emit('inactive', { sourceName: this.name, coldStart: true });
   }
}

PeerSource.prototype.isActive = function(_callback) {
   return this.props['ACTIVE'];
}

PeerSource.prototype.invalidateSource = function() {
   this.sourceEnabled = false;
   this.emit('invalid', { sourceName: this.name });
}

module.exports = exports = PeerSource;

