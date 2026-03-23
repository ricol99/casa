var util = require('util');
var SourceConsoleApi = require('./sourceconsoleapi');

function ThingConsoleApi(_config, _owner) {
   SourceConsoleApi.call(this, _config, _owner);
}

util.inherits(ThingConsoleApi, SourceConsoleApi);

function thingOwnOrNull(_obj, _prop) {

   if (!_obj || !Object.prototype.hasOwnProperty.call(_obj, _prop)) {
      return null;
   }

   return _obj[_prop];
}

function thingDescribeNamedObject(_obj) {

   if (!_obj) {
      return null;
   }

   return {
      uName: _obj.uName,
      name: _obj.name,
      type: _obj.type || null,
      superType: (typeof _obj.superType === "function") ? _obj.superType() : null,
      ownerUName: _obj.owner ? _obj.owner.uName : null,
      ownerCasa: (typeof _obj.getCasa === "function" && _obj.getCasa()) ? _obj.getCasa().name : null
   };
}

function thingDescribePropagation(_obj, _parentThing) {
   var topLevelThing = !!(_obj && _obj.topLevelThing);
   var hasParentThing = !!_parentThing;
   var ignoreParent = !!(_obj && _obj.ignoreParent);
   var ignoreChildren = !!(_obj && _obj.ignoreChildren);
   var propagateToParent = !!(_obj && _obj.propagateToParent);
   var propagateToChildren = !!(_obj && _obj.propagateToChildren);

   return {
      objectLevel: {
         ignoreParent: ignoreParent,
         ignoreChildren: ignoreChildren,
         propagateToParent: propagateToParent,
         propagateToChildren: propagateToChildren
      },
      effective: {
         hasParentThing: hasParentThing,
         receivesFromParent: hasParentThing && !ignoreParent && (!!_parentThing.topLevelThing || !!_parentThing.propagateToChildren),
         sendsToParent: hasParentThing && propagateToParent && !_parentThing.ignoreChildren,
         receivesFromChildren: !ignoreChildren,
         sendsToChildren: propagateToChildren,
         topLevelThing: topLevelThing
      }
   };
}

function thingDescribeMember(_member, _thing) {
   var type = _member && _member.type ? _member.type : ((typeof _member.superType === "function") ? _member.superType() : null);

   return {
      uName: _member.uName,
      name: _member.name,
      type: type,
      local: !!_member.local,
      valid: (_member.valid === undefined) ? null : !!_member.valid,
      cold: (_member.cold === undefined) ? null : !!_member.cold,
      value: (_member.value === undefined) ? null : _member.value,
      inherited: {
         parent: !!(_member.config && _member.config.parentInherited),
         child: !!(_member.config && _member.config.childInherited)
      },
      propagation: {
         raw: {
            ignoreParent: thingOwnOrNull(_member, "ignoreParent"),
            ignoreChildren: thingOwnOrNull(_member, "ignoreChildren"),
            propagateToParent: thingOwnOrNull(_member, "propagateToParent"),
            propagateToChildren: thingOwnOrNull(_member, "propagateToChildren")
         },
         effective: {
            ignoreParent: Object.prototype.hasOwnProperty.call(_member, "ignoreParent") ? _member.ignoreParent : _thing.ignoreParent,
            ignoreChildren: Object.prototype.hasOwnProperty.call(_member, "ignoreChildren") ? _member.ignoreChildren : _thing.ignoreChildren,
            propagateToParent: Object.prototype.hasOwnProperty.call(_member, "propagateToParent") ? _member.propagateToParent : _thing.propagateToParent,
            propagateToChildren: Object.prototype.hasOwnProperty.call(_member, "propagateToChildren") ? _member.propagateToChildren : _thing.propagateToChildren
         }
      },
      sourceListenerCount: _member.sourceListeners ? Object.keys(_member.sourceListeners).length : 0
   };
}

function thingDescribeChild(_child, _thing) {

   if (!_child) {
      return null;
   }

   return {
      object: thingDescribeNamedObject(_child),
      propagation: {
         receivesFromParent: !_child.ignoreParent && !!_thing.propagateToChildren,
         sendsToParent: !!_child.propagateToParent && !_thing.ignoreChildren
      }
   };
}

function thingSortByName(_a, _b) {

   if (_a.name === _b.name) {
      return (_a.uName || "").localeCompare(_b.uName || "");
   }

   return _a.name.localeCompare(_b.name);
}

function thingDescribeExternalMember(_member, _ownerThing) {
   return {
      name: _member.name,
      type: _member.type || ((typeof _member.superType === "function") ? _member.superType() : null),
      uName: _member.uName || null,
      viaThingUName: _ownerThing ? _ownerThing.uName : null,
      viaThingName: _ownerThing ? _ownerThing.name : null
   };
}

function thingBuildInheritanceSummary(_thing, _parentThing, _properties, _events) {
   var inheritance = {
      properties: { local: [], parent: [], child: [] },
      events: { local: [], parent: [], child: [] },
      blocked: {
         fromParent: { properties: [], events: [] },
         fromChildren: { properties: [], events: [] }
      }
   };
   var propName;
   var eventName;
   var childName;

   for (var i = 0; i < _properties.length; ++i) {
      var property = _properties[i];

      if (property.inherited.parent) {
         inheritance.properties.parent.push(property);
      }
      else if (property.inherited.child) {
         inheritance.properties.child.push(property);
      }
      else {
         inheritance.properties.local.push(property);
      }
   }

   for (var j = 0; j < _events.length; ++j) {
      var event = _events[j];

      if (event.inherited.parent) {
         inheritance.events.parent.push(event);
      }
      else if (event.inherited.child) {
         inheritance.events.child.push(event);
      }
      else {
         inheritance.events.local.push(event);
      }
   }

   if (_parentThing && _thing.ignoreParent) {

      for (propName in _parentThing.properties) {

         if (_parentThing.properties.hasOwnProperty(propName) && !_thing.properties.hasOwnProperty(propName)) {
            inheritance.blocked.fromParent.properties.push(thingDescribeExternalMember(_parentThing.properties[propName], _parentThing));
         }
      }

      for (eventName in _parentThing.events) {

         if (_parentThing.events.hasOwnProperty(eventName) && !_thing.events.hasOwnProperty(eventName)) {
            inheritance.blocked.fromParent.events.push(thingDescribeExternalMember(_parentThing.events[eventName], _parentThing));
         }
      }
   }

   for (childName in _thing.things) {

      if (_thing.things.hasOwnProperty(childName)) {
         var childThing = _thing.things[childName];
         var childAllowsToParent = !!childThing.propagateToParent;

         for (propName in childThing.properties) {

            if (childThing.properties.hasOwnProperty(propName)) {
               var childProp = childThing.properties[propName];
               var propAllowsToParent = Object.prototype.hasOwnProperty.call(childProp, "propagateToParent") ? !!childProp.propagateToParent : childAllowsToParent;

               if ((_thing.ignoreChildren || !propAllowsToParent) && !_thing.properties.hasOwnProperty(propName)) {
                  inheritance.blocked.fromChildren.properties.push(thingDescribeExternalMember(childProp, childThing));
               }
            }
         }

         for (eventName in childThing.events) {

            if (childThing.events.hasOwnProperty(eventName)) {
               var childEvent = childThing.events[eventName];
               var eventAllowsToParent = Object.prototype.hasOwnProperty.call(childEvent, "propagateToParent") ? !!childEvent.propagateToParent : childAllowsToParent;

               if ((_thing.ignoreChildren || !eventAllowsToParent) && !_thing.events.hasOwnProperty(eventName)) {
                  inheritance.blocked.fromChildren.events.push(thingDescribeExternalMember(childEvent, childThing));
               }
            }
         }
      }
   }

   inheritance.blocked.fromParent.properties.sort(thingSortByName);
   inheritance.blocked.fromParent.events.sort(thingSortByName);
   inheritance.blocked.fromChildren.properties.sort(thingSortByName);
   inheritance.blocked.fromChildren.events.sort(thingSortByName);

   return inheritance;
}

// Called when current state required
ThingConsoleApi.prototype.export = function(_exportObj) {
   SourceConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
ThingConsoleApi.prototype.import = function(_importObj) {
   SourceConsoleApi.prototype.import.call(this, _importObj);
};

ThingConsoleApi.prototype.coldStart = function() {
   SourceConsoleApi.prototype.coldStart.call(this);
};

ThingConsoleApi.prototype.hotStart = function() {
   SourceConsoleApi.prototype.hotStart.call(this);
};

ThingConsoleApi.prototype.findMyThingInConfig = function(_thingConfig) {

   if (_thingConfig.name === this.uName) {
      return _thingConfig;
   }

   if (_thingConfig.hasOwnProperty("things") && (_thingConfig.things.length > 0)) {

      for (var i = 0; i < _thingConfig.things.length; ++i) {
         var result = this.findMyThingInConfig(_thingConfig.things[i]);

         if (result) {
            return result;
         }
      }
   }

   return null;
};

ThingConsoleApi.prototype.createThing = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var config = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;
   var thingUName = config.name && config.name.startsWith(":") ? config.name : ":" + config.name;

   if (this.gang.findNamedObject(thingUName)) {
      return _callback("Thing already exists!");
   }

   var topThing = this.myObj().getTopThing();

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(topThing.name, (_err, _topThingConfig) => {

         if (_err || (_topThingConfig === null)) {
            return _callback("Unable to persist new Thing!");
         }

         var myThingInConfig = this.findMyThingInConfig(_topThingConfig);

         if (!myThingInConfig) {
            return _callback("Unable to persist new Thing!");
         }

         if (myThingInConfig.hasOwnProperty("things")) {
            myThingInConfig.things.push(config);
         }
         else {
            myThingInConfig.things = [ config ];
         }

         this.db.update(_topThingConfig, (_err2, _result2) => {

            if (_err2) {
               return _callback("Unable to perist the change");
            }

            var thingObj = this.gang.createThing(config, this.myObj());
            topThing.inheritChildProps();
            this.gang.casa.refreshSourceListeners();
            thingObj.coldStart();
            return _callback(null, true);
         });
      });
   }
   else {
      var thingObj = this.gang.createThing(config);
      topThing.inheritChildProps();
      this.gang.casa.refreshSourceListeners();
      thingObj.coldStart();
      _callback(null, true);
   }
};

ThingConsoleApi.prototype.createProperty = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var config = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (this.myObj().properties.hasOwnProperty(config.name)) {
      return _callback("Property already exists!");
   }

   var topThing = this.myObj().getTopThing();

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(topThing.name, (_err, _topThingConfig) => {

         if (_err || (_topThingConfig === null)) {
            return _callback("Unable to persist new property!");
         }

         var myThingInConfig = this.findMyThingInConfig(_topThingConfig);

         if (!myThingInConfig) {
            return _callback("Unable to persist new property!");
         }

         if (myThingInConfig.hasOwnProperty("properties")) {
            myThingInConfig.properties.push(config);
         }
         else {
            myThingInConfig.properties = [ config ];
         }

         this.db.update(_topThingConfig, (_err2, _result2) => {

            if (_err2) {
               return _callback("Unable to perist the change");
            }

            this.myObj().createProperty(config);
            topThing.inheritChildProps();
            this.gang.casa.refreshSourceListeners();
            this.myObj().properties[config.name].coldStart();
            return _callback(null, true);
         });
      });
   }
   else {
      this.myObj().createProperty(config);
      topThing.inheritChildProps();
      this.gang.casa.refreshSourceListeners();
      this.myObj().properties[config.name].coldStart();
      _callback(null, true);
   }
};

ThingConsoleApi.prototype.describeThing = function(_session, _params, _callback) {
   this.checkParams(0, _params);
   var thing = this.myObj();

   if (!thing) {
      return _callback("Thing not found");
   }

   var parentThing = (thing.owner && (typeof thing.owner.superType === "function") && (thing.owner.superType() === "thing")) ? thing.owner : null;
   var children = [];
   var properties = [];
   var events = [];

   for (var childName in thing.things) {

      if (thing.things.hasOwnProperty(childName)) {
         children.push(thingDescribeChild(thing.things[childName], thing));
      }
   }

   for (var propertyName in thing.properties) {

      if (thing.properties.hasOwnProperty(propertyName)) {
         properties.push(thingDescribeMember(thing.properties[propertyName], thing));
      }
   }

   for (var eventName in thing.events) {

      if (thing.events.hasOwnProperty(eventName)) {
         events.push(thingDescribeMember(thing.events[eventName], thing));
      }
   }

   children.sort( (_a, _b) => _a.object.uName.localeCompare(_b.object.uName) );
   properties.sort( (_a, _b) => _a.name.localeCompare(_b.name) );
   events.sort( (_a, _b) => _a.name.localeCompare(_b.name) );

   return _callback(null, {
      thing: {
         object: thingDescribeNamedObject(thing),
         topLevelThing: !!thing.topLevelThing,
         local: !!thing.local,
         fromPeer: !!thing.fromPeer,
         bowing: !!thing.bowing,
         priority: (thing.priority === undefined) ? null : thing.priority
      },
      parent: parentThing ? {
         object: thingDescribeNamedObject(parentThing),
         propagation: {
            receivesFromParent: !thing.ignoreParent && (!!parentThing.topLevelThing || !!parentThing.propagateToChildren),
            sendsToParent: !!thing.propagateToParent && !parentThing.ignoreChildren
         }
      } : null,
      propagation: thingDescribePropagation(thing, parentThing),
      children: children,
      properties: properties,
      events: events,
      inheritance: thingBuildInheritanceSummary(thing, parentThing, properties, events)
   });
};

module.exports = exports = ThingConsoleApi;
 
