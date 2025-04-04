var util = require('./util');
var NamedObject = require('./namedobject');
var SourceListener = require('./sourcelistener');

function Event(_config, _owner) {
   NamedObject.call(this, _config, _owner);

   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   this.cold = true;

   var parent = { public: true, protected: false, private: false, parent: true, children: false, both: true };
   var child = { public: true, protected: true, private: false, parent: false, children: true, both: true };

   if (_config.hasOwnProperty('ignorePropagation')) {
      this.ignoreParent = parent.hasOwnProperty(_config.ignorePropagation) ? parent[_config.ignorePropagation] : false;
      this.ignoreChildren = child.hasOwnProperty(_config.ignorePropagation) ? child[_config.ignorePropagation] : false;
   }
   else {
      if (_config.hasOwnProperty('ignoreParent')) this.ignoreParent = _config.ignoreParent;
      if (_config.hasOwnProperty('ignoreChildren')) this.ignoreChildren = _config.ignoreChildren;
   }

   if (_config.hasOwnProperty('propagation')) {
      this.propagateToParent = parent.hasOwnProperty(_config.propagation) ? parent[_config.propagation] : true;
      this.propagateToChildren = child.hasOwnProperty(_config.propagation) ? child[_config.propagation] : true;
   }
   else {
      if (_config.hasOwnProperty('propagateToParent')) this.propagateToParent = _config.propagateToParent;
      if (_config.hasOwnProperty('propagateToChildren')) this.propagateToChildren = _config.propagateToChildren;
   }

   this.sourceListeners = {};

   if (_config.hasOwnProperty('source')) {
      _config.sources = [_config.source];
   }

   if (_config.hasOwnProperty('sources')) {

      for (var index = 0; index < _config.sources.length; ++index) {
         this._addSource(_config.sources[index]);
      }
   }

   if (this.owner.gang.casa) {
      this.owner.gang.casa.scheduleRefreshSourceListeners();
   }
}

util.inherits(Event, NamedObject);

// Used to classify the type and understand where to load the javascript module
Event.prototype.superType = function(_type) {
   return "event";
};

// Called when system state is required
Event.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   _exportObj.value = this.value;
   _exportObj.cold = this.cold;
};

// Called when system state is required
Event.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
   this.value = _importObj.value;
   this.cold = _importObj.cold;
};

// Derived Events should override this for start-up code
Event.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
   this.cold = false;
};

// Derived Events should override this for hot start-up code
Event.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
};

// 
// Actual tell all listening parties that this property is not to be listened to anymore.
// Pretend it is invalid but really the source is bowing and functioning silently
//
Event.prototype.loseListeners = function () {
   console.log(this.uName + ': Losing Listeners due to source bowing'); 
   this.owner.eventGoneInvalid(this.name);
}; 

Event.prototype.getCasa = function() {
   return this.owner.getCasa();
};

Event.prototype.refreshSourceListeners = function() {

   if (this.hasOwnProperty("sourceListeners")) {

      for (var sourceListenerName in this.sourceListeners) {

         if (this.sourceListeners.hasOwnProperty(sourceListenerName)) {
            this.sourceListeners[sourceListenerName].refreshSource();
         }
      }
   }
};

//
// Derived Events can use this to be called just before the event is raised
// You cannot stop the event from being raised, it is for information only
//
Event.prototype.eventAboutToBeRaised = function(_data) {
   // BY DEFAULT, DO NOTHING
};

//
// Derived Events can use this to be called just before the event is deleted
// You cannot stop the event from being deleted, it is for information only
//
Event.prototype.aboutToBeDeleted = function() {
};

// Add a new source to the event - not persisted
Event.prototype.addNewSource = function(_config) {
   var config = this.owner.generateDynamicSourceConfig(_config);
   config.listeningSource = this.owner.uName;
   var sourceListener = new SourceListener(config, this);
   this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
   sourceListener.refreshSource();
};    
   
// Remove an exisiting source to the event - not persisted
Event.prototype.removeExistingSource = function(_config) {
   var sourceId = this.owner.generateDynamicSourceId(_config);
   
   for (var listener in this.sourceListeners) {
      
      if (this.sourceListeners.hasOwnProperty(listener)) {
         
         let id = this.sourceListeners[listener].getId();
         
         if (id && (id === sourceId)) {
            this.sourceListeners[listener].stopListening();
            delete this.sourceListeners[listener];
            break;
         }
      }
   }
}; 

Event.prototype.raise = function(_data) {
   var data = (_data) ? util.copy(_data) : { sourceName: this.owner.uName };

   if (this.hasOwnProperty("value")) {
      data.value = this.value;
   }

   this.owner.raiseEvent(this.name, data);
};

//
// Called by SourceListener as a defined source has become valid again (available)
Event.prototype.sourceIsValid = function(_data) {
   // Do nothing
};

//
// Called by SourceListener as a defined source has become invalid (unavailable)
Event.prototype.sourceIsInvalid = function(_data) {
   // Do nothing
};

//
// Called by SourceListener as a defined source has changed it property value
Event.prototype.receivedEventFromSource = function(_data) {

   if (this.sourceListeners[_data.sourceEventName]) {
      this.newEventReceivedFromSource(this.sourceListeners[_data.sourceEventName], _data);
   }
};

//
// Derived Events should override this to process property changes from defined sources
//
Event.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.raise(_data);
};

// ====================
// INTERNAL METHODS
// ====================

Event.prototype._addSource = function(_source) {

   if (!_source.hasOwnProperty("uName") || _source.uName == undefined) {
      _source.uName = this.owner.uName;
   }

   _source.listeningSource = this.owner.uName;
   var sourceListener = new SourceListener(_source, this);
   this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
};

module.exports = exports = Event;
