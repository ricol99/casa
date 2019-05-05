var util = require('./util');
var AsyncEmitter = require('./asyncemitter');
var Gang = require('./gang');

function SourceBase() {
   AsyncEmitter.call(this);
   this.valid = true;
   this.bowing = false;
   this.gang = Gang.mainInstance();
   this.props = {};
}

util.inherits(SourceBase, AsyncEmitter);

SourceBase.prototype.isActive = function() {
   return this.props['ACTIVE'].value;
};

SourceBase.prototype.bowToOtherSource = function() {
   this.bowing = true;
   this.changeName('*'+this.uName, false);
};

SourceBase.prototype.coldStart = function() {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.props[prop].coldStart();
      }
   }
};

SourceBase.prototype.isPropertyValid = function(_property) {

   if (this.props.hasOwnProperty(_property)) {
      return this.props[_property].valid;
   }
   else {
      return true;
   }
};

SourceBase.prototype.getProperty = function(_property) {
   return (this.props.hasOwnProperty(_property)) ? this.props[_property].getValue() : undefined;
};

SourceBase.prototype.hasProperty = function(_property) {
   return this.props.hasOwnProperty(_property);
};

SourceBase.prototype.getAllProperties = function(_allProps) {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = this.props[prop].value;
      }
   }
};

SourceBase.prototype.dropSourceListeners = function(_propName, _sourceData) {
   console.log(this.uName + ": Raising invalid on all props to drop source listeners");

   for(var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.emit('invalid', { sourceName: this.uName, name: prop });
      }
   }
}

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
SourceBase.prototype.emitPropertyChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ': Emitting Property Change (Child) ' + _propName + ' is ' + _propValue);

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.sourceName = this.uName;
   sendData.name = _propName;
   sendData.value = _propValue;
   sendData.local = this.local;
   this.asyncEmit('property-changed', sendData);
};

SourceBase.prototype.alignPropertyRamp = function(_propName, _rampConfig) {
   this.alignProperties([ { property: _propName, ramp: _rampConfig } ]);
};

SourceBase.prototype.alignPropertyValue = function(_propName, _nextPropValue) {
   this.alignProperties([ { property: _propName, value: _nextPropValue } ]);
};

SourceBase.prototype.rejectPropertyUpdate = function(_propName) {
   this.alignPropertyValue(_propName, this.props[_propName].value);
};

SourceBase.prototype.ensurePropertyExists = function(_propName, _propType, _config, _mainConfig) {

   if (!this.props.hasOwnProperty(_propName)) {
      var loadPath =  ((_propType === 'property') || (_propType === 'stateproperty')) ? '' : 'properties/'
      var Prop = require('./' + loadPath + _propType);
      _config.name = _propName;
      _config.type = _propType;
      this.props[_propName]  = new Prop(_config, this);

      if (_mainConfig) {

         if (!_mainConfig.hasOwnProperty("props")) {
            _mainConfig.props = [ _config ];
         }
         else {
            _mainConfig.props.push(_config);
         }
      }
      return true;
   }
   return false;
};

SourceBase.prototype.raiseEvent = function(_eventName, _data) {

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.local = this.local;
   sendData.sourceName = this.uName;
   sendData.name = _eventName;

   if (!sendData.hasOwnProperty("value")) {
      sendData.value = true;
   }

   console.log(this.uName + ": Emitting event " + _eventName);
   this.asyncEmit('event-raised', sendData);
}

SourceBase.prototype.changeName = function(_newName, _updateCasa) {

   if ((_updateCasa === undefined) || _updateCasa) {
      this.casa.renameSource(this, _newName);
   }

   this.uName = _newName;

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.props[prop].ownerHasNewName();
      }
   }
};

// Called by peerSource to check for overriding
SourceBase.prototype.deferToPeer = function(_newSource) {

   if (_newSource.priority > this.priority) {
      this.bowing = true;
      this.local = true;
      console.log(this.uName+": Bowing to new source");
      console.info(this.uName+": AAAAAA bowing to new source");
      this.dropSourceListeners();
      this.bowToOtherSource();
      return true;
   }

   return false;
};

// Called by peerSource to check for overriding
SourceBase.prototype.becomeMainSource = function(_oldMainSource) {

   if (this.bowing) {
      console.log(this.uName + ": Becoming main source again!");
      this.bowing = false;
      this.local = (this.config.hasOwnProperty('local')) ? this.config.local : false;
      this.changeName(this.uName.substring(1));
      this.gang.allObjects[this.uName] = this;
      return true;
   }

   return false;
};


module.exports = exports = SourceBase;
 
