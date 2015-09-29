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
   console.info('Property Changed: ' + this.name + ':' + _data.propertyName + ': ' + _data.propertyValue);
   this.props[_data.propertyName] = _data.propertyValue;
   this.emit('property-changed', _data);
}

PeerSource.prototype.setActive = function(_data, _callback) {
   console.log(this.name + ': Attempting to set source to active');
   this.peerCasa.setSourceActive(this, _data, _callback);
}

PeerSource.prototype.setInactive = function(_data, _callback) {
   console.log(this.name + ': Attempting to set source to inactive');
   this.peerCasa.setSourceInactive(this, _data, _callback);
}

PeerSource.prototype.isPropertyEnabled = function(_property) {
   return true;
}

PeerSource.prototype.setProperty = function(_propName, _propValue, _data, _callback) {
   console.log(this.name + ': Attempting to set source property');
   this.peerCasa.setSourceProperty(this, _propName, _propValue, _data, _callback);
}

PeerSource.prototype.getProperty = function(_propName) {
   return this.props[_propName];
}

PeerSource.prototype.coldStart = function() {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         var sendData = {};
         sendData.sourceName = this.name;
         sendData.propertyName = prop;
         sendData.propertyValue = this.props[prop];
         sendData.coldStart = true;
         console.info('Property Changed: ' + this.name + ':' + prop + ': ' + sendData.propertyValue);
         this.emit('property-changed', sendData);
      }
   }
}

PeerSource.prototype.isActive = function(_callback) {
   return this.props['ACTIVE'];
}

PeerSource.prototype.invalidateSource = function() {
   this.sourceEnabled = false;

   for(var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.emit('invalid', { sourceName: this.name, propertyName: this.props[prop] });
      }
   }
}

module.exports = exports = PeerSource;

