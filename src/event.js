var util = require('./util');
var NamedObject = require('./namedobject');
var SourceListener = require('./sourcelistener');

function Event(_config, _owner) {
   NamedObject.call(this, _config, _owner);

   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;
   this.cold = true;

   this.sourceListeners = {};
   this.noOfSources = 0;

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

Event.prototype.getCasa = function() {
   return this.owner.getCasa();
};

// Derived Events should override this for start-up code
Event.prototype.coldStart = function() {
   this.cold = false;
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

// Add a new source to the property - not persisted
Event.prototype.addNewSource = function(_config) {
   var sourceListener = new SourceListener(_config, this);
   this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
   this.noOfSources++;
   sourceListener.refreshSource();
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
      this.raise(_data);
   }
};

// ====================
// INTERNAL METHODS
// ====================

Event.prototype._addSource = function(_source) {

   if (!_source.hasOwnProperty("uName") || _source.uName == undefined) {
      _source.uName = this.owner.uName;
   }

   var sourceListener = new SourceListener(_source, this);
   this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
   this.noOfSources++;
};

module.exports = exports = Event;
