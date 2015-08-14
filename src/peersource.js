var util = require('util');
var events = require('events');
var S = require('string');

function PeerSource(_name, _props, _peerCasa) {
   this.name = _name;
   this.props = _props;
   this.peerCasa = _peerCasa;
   this.sourceEnabled = true;
   
   this.active = false;

   events.EventEmitter.call(this);

   var that = this;

   this.peerCasa.addSource(this);
}

util.inherits(PeerSource, events.EventEmitter);

PeerSource.prototype.sourceHasGoneActive = function(_data) {
   console.log(this.name + ': received active event from peer. Going active!', _data);
   this.active = true;
   this.emit('active', _data);
}

PeerSource.prototype.sourceHasGoneInactive = function(_data) {
   console.log(this.name + ': received inactive event from peer. Going inactive!', _data);
   this.active = false;
   this.emit('inactive', _data);
}

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
   return (_propName == 'ACTIVE') ? this.isActive() : this.props[_propName];
}

PeerSource.prototype.coldStart = function() {

   if (this.active) {
      this.emit('active', { sourceName: this.name, coldStart: true });
   }
   else {
      this.emit('inactive', { sourceName: this.name, coldStart: true });
   }
}

PeerSource.prototype.isActive = function(_callback) {
   return this.active;
}

PeerSource.prototype.invalidateSource = function() {
   this.sourceEnabled = false;
   this.emit('invalid', { sourceName: this.name });
}

module.exports = exports = PeerSource;

