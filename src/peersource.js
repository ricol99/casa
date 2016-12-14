var util = require('util');
var events = require('events');
var S = require('string');
var CasaSystem = require('./casasystem');

function PeerSource(_name, _props, _peerCasa) {
   this.name = _name;
   this.props = _props;
   this.peerCasa = _peerCasa;
   this.sourceEnabled = true;

   var casaSys = CasaSystem.mainInstance();
   var source = casaSys.findSource(_name);

   if (source) {
      this.ghostMode = true;
      this.myRealSource = source;
      console.log(this.name + ': Creating a ghost peer source as a source with the same name already exists in this local casa.');
   }
   else {
      casaSys.allObjects[this.name] = this;
   }
   
   events.EventEmitter.call(this);

   var that = this;

   this.peerCasa.addSource(this);
}

util.inherits(PeerSource, events.EventEmitter);

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.name + ': received changed-property event from peer.');

   // If I am a ghost source (the source also exists in this casa), then tell it. Otherwise, act like I am the source
   if (this.ghostMode) {

      if (this.myRealSource.sourceHasChangedProperty(_data)) {
         this.props[_data.propertyName] = _data.propertyValue;
      }
   }
   else {
      console.info('Property Changed: ' + this.name + ':' + _data.propertyName + ': ' + _data.propertyValue);
      this.props[_data.propertyName] = _data.propertyValue;
      this.emit('property-changed', copyData(_data));
   }
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
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

   if (!this.ghostMode) {

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
}

PeerSource.prototype.invalidateSource = function() {

   if (!this.ghostMode) {
      this.sourceEnabled = false;

      for(var prop in this.props) {

         if (this.props.hasOwnProperty(prop)) {
            this.emit('invalid', { sourceName: this.name, propertyName: this.props[prop] });
         }
      }
   }
}

module.exports = exports = PeerSource;

