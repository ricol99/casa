var util = require('./util');
var NamedObject = require('./namedobject');
var Gang = require('./gang');

function SourceBase(_uName, _owner) {
   NamedObject.call(this, _uName, _owner);
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.bowing = false;
   this.props = {};

   this.setMaxListeners(0);
}

util.inherits(SourceBase, NamedObject);

SourceBase.prototype.subscriptionRegistered = function(_event, _subscription) {
   console.log(this.fullName+": subscriptionRegistered() :" + _event);

   if (_event === "property-changed") {
      this.propertySubscribedTo(_subscription.prop, _subscription, this.props.hasOwnProperty(_subscription.prop));
   }
   else {
      this.eventSubscribedTo(_event, _subscription);
   }
};

// Override this to learn of new subscriptions to properties
// _property - property name
// _subscription - usually an object - provided by subscriber
// _exists - whether the property is currently defined in this source
SourceBase.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {
};

// Override this to learn of new subscriptions to events
// _event - event name
// _subscription - usually an object - provided by subscriber
SourceBase.prototype.eventSubscribedTo = function(_event, _subscription) {
};

SourceBase.prototype.bowToOtherSource = function() {
   this.bowing = true;
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

SourceBase.prototype.hasProperty = function(_property) {
   return this.props.hasOwnProperty(_property);
};

SourceBase.prototype.getProperty = function(_property) {

   if (!this.props.hasOwnProperty(_property)) {
      console.error(this.fullName + ": Asked for property " + _property + " that I don't have.");
   }

   return (this.props.hasOwnProperty(_property)) ? this.props[_property].getValue() : undefined;
};

SourceBase.prototype.getAllProperties = function(_allProps) {

   for (var prop in this.props) {

      if (this.props.hasOwnProperty(prop) && !_allProps.hasOwnProperty(prop)) {
         _allProps[prop] = this.props[prop].value;
      }
   }
};

SourceBase.prototype.goInvalid = function(_propName, _data) {
   console.log(this.fullName + ": Property " + _propName + " going invalid! Previously active state=" + this.props[_propName].value);

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.sourceName =  this.fullName;
   sendData.oldState = this.props[_propName].value;
   sendData.name = _propName;
   console.log(this.fullName + ": Emitting invalid!");

   this.emit('invalid', sendData);
}

SourceBase.prototype.invalidate = function() {
   console.log(this.fullName + ": Raising invalid on all props to drop source listeners");

   if (this.alignmentTimeout || (this.propertyAlignmentQueue && (this.propertyAlignmentQueue.length > 0))) {
      this.clearAlignmentQueue();
   }

   for(var prop in this.props) {

      if (this.props.hasOwnProperty(prop)) {
         this.goInvalid(prop);
      }
   }
}

// INTERNAL METHOD AND FOR USE BY PROPERTIES 
SourceBase.prototype.emitPropertyChange = function(_propName, _propValue, _data) {
   console.info(this.fullName + ': Property Changed: ' + _propName + ': ' + _propValue);

   var sendData = (_data) ? util.copy(_data) : {};
   sendData.sourceName = this.fullName;
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
   sendData.sourceName = this.fullName;
   sendData.name = _eventName;

   if (!sendData.hasOwnProperty("value")) {
      sendData.value = true;
   }

   console.log(this.fullName + ": Emitting event " + _eventName);
   this.asyncEmit('event-raised', sendData);
}

SourceBase.prototype.changeName = function(_newName) {
   this.setUName(_newName);

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
      console.log(this.fullName+": Bowing to new source");
      this.invalidate();
      this.setUName(this.casa.sName+"-"+this.uName);
      this.bowToOtherSource();
      return true;
   }

   return false;
};

// Called by peerSource to check for overriding
SourceBase.prototype.becomeMainSource = function(_owner) {

   if (this.bowing) {
      console.log(this.fullName + ": Becoming main source again!");
      this.bowing = false;
      this.local = (this.config.hasOwnProperty('local')) ? this.config.local : false;
      this.changeName(this.uName.replace(this.casa.sName+"-", ""));
      this.setOwner(_owner);
      return true;
   }

   return false;
};

SourceBase.prototype.alignPropertyRamp = function(_propName, _rampConfig) {
   this.alignProperties([ { property: _propName, ramp: _rampConfig } ]);
};

// Please override these two methods to actually set property values
SourceBase.prototype.setProperty = function(_propName, _propValue, _data) {
   return false;
};

SourceBase.prototype.setPropertyWithRamp = function(_propName, _ramp, _data) {
   return false;
};

SourceBase.prototype.alignPropertyValue = function(_propName, _nextPropValue) {
   this.alignProperties([ { property: _propName, value: _nextPropValue } ]);
};

SourceBase.prototype.alignProperties = function(_properties) {

   if (_properties && (_properties.length > 0)) {
      console.log(this.fullName + ": alignProperties() ", _properties.length);
      this.addPropertiesForAlignment(_properties);
      this.alignNextProperty();
   }
};

// Internal
SourceBase.prototype.addPropertiesForAlignment = function(_properties) {

   if (!this.propertyAlignmentQueue) {
      this.propertyAlignmentQueue = [];
   }

   for (var i = 0; i < _properties.length; ++i) {

      if (_properties[i].hasOwnProperty("ramp")) {
         var ramp = util.copy(_properties[i].ramp);

         if (_properties[i].ramp.hasOwnProperty("ramps")) {
            ramp.ramps = util.copy(_properties[i].ramp.ramps, true);
         }

         this.propertyAlignmentQueue.push({ property: _properties[i].property, ramp: ramp });
      }
      else {
         console.log(this.fullName + ": addPropertyForAlignment() property=" + _properties[i].property + " value=" + _properties[i].value);
         this.propertyAlignmentQueue.push({ property: _properties[i].property, value: _properties[i].value });
      }
   }
};

// Internal
SourceBase.prototype.alignNextProperty = function() {

   if (!this.alignmentTimeout && (this.propertyAlignmentQueue.length > 0)) {

      this.alignmentTimeout = setTimeout( () => {
         this.alignmentTimeout = null;

         if (this.propertyAlignmentQueue.length > 0) {
            var prop = this.propertyAlignmentQueue.shift();

            if (prop.hasOwnProperty("ramp")) {
               console.log(this.fullName + ": Setting property " + prop.property + " to ramp");
               this.setPropertyWithRamp(prop.property, prop.ramp, { sourceName: this.fullName });
            }
            else {
               console.log(this.fullName + ": Setting property " + prop.property + " to value " + prop.value);
               this.setProperty(prop.property, prop.value, { sourceName: this.fullName });
            }
            this.alignNextProperty();
         }
         else {
            console.error(this.fullName + ": Something has gone wrong as no alignments are in the queue!");
         }
      }, 1);
   }
};

SourceBase.prototype.clearAlignmentQueue = function() {
   clearTimeout(this.alignmentTimeout);
   this.alignmentTimeout = null;
   this.propertyAlignmentQueue = [];
}


module.exports = exports = SourceBase;
 
