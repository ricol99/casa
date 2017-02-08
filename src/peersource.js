var util = require('util');
var events = require('events');
var S = require('string');
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

   var that = this;

   this.peerCasa.addSource(this);
}

util.inherits(PeerSource, events.EventEmitter);

PeerSource.prototype.sourceHasChangedProperty = function(_data) {
   console.log(this.uName + ': received changed-property event from peer.');

   // If I am a ghost source (the source also exists in this casa), then tell it. Otherwise, act like I am the source
   if (this.ghostMode) {

      if (this.myRealSource.sourceHasChangedProperty(_data)) {
         this.props[_data.propertyName] = { value: _data.propertyValue };
      }
   }
   else {
      console.info('Property Changed: ' + this.uName + ':' + _data.propertyName + ': ' + _data.propertyValue);
      this.props[_data.propertyName] = { value: _data.propertyValue };
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

PeerSource.prototype.isPropertyValid = function(_property) {
   return true;
}

PeerSource.prototype.setProperty = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Attempting to set source property');
   return this.peerCasa.setSourceProperty(this, _propName, _propValue, _data);
}

PeerSource.prototype.getProperty = function(_propName) {
   return this.props[_propName].value;
}

PeerSource.prototype.invalidateSource = function() {

   if (!this.ghostMode) {
      this.valid = false;

      for(var prop in this.props) {

         if (this.props.hasOwnProperty(prop)) {
            this.emit('invalid', { sourceName: this.uName, propertyName: prop });
         }
      }
   }
}

module.exports = exports = PeerSource;

