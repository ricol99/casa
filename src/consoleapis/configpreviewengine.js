var JSON5 = require('json5');

function isObject(_obj) {
   return (_obj && (typeof _obj === "object") && !(_obj instanceof Array));
}

function deepCopy(_obj) {
   return (_obj === undefined) ? _obj : JSON.parse(JSON.stringify(_obj));
}

function normaliseSourceUName(_uName) {

   if (typeof _uName !== "string") {
      return null;
   }

   var uName = _uName.trim();

   if (uName.length === 0) {
      return null;
   }

   if (uName[0] !== ":") {
      uName = ":" + uName;
   }

   return uName;
}

function splitUNameParts(_uName) {

   if (typeof _uName !== "string") {
      return [];
   }

   var uName = normaliseSourceUName(_uName);

   if (!uName) {
      return [];
   }

   var trimmed = (uName[0] === ":") ? uName.substr(1) : uName;
   return trimmed.length === 0 ? [] : trimmed.split(":");
}

function parsePatchInput(_patchInput, _errors) {

   if (_patchInput === undefined || _patchInput === null) {
      _errors.push("Patch not provided");
      return null;
   }

   if (typeof _patchInput === "string") {

      try {
         return JSON5.parse(_patchInput);
      }
      catch (_err) {
         _errors.push("Invalid patch JSON: " + (_err && _err.message ? _err.message : _err));
         return null;
      }
   }

   if (isObject(_patchInput)) {
      return _patchInput;
   }

   _errors.push("Patch must be an object or JSON string");
   return null;
}

function deriveScopeFromPath(_path) {
   var path = _path ? _path.toLowerCase() : "";

   if ((path.indexOf("gang") !== -1) || (path.indexOf("gangthings") !== -1) || (path.indexOf("gangservices") !== -1) ||
       (path.indexOf("gangscenes") !== -1) || (path.indexOf("gangusers") !== -1)) {
      return "gang";
   }

   if ((path.indexOf("casa") !== -1) || (path.indexOf("casathings") !== -1) || (path.indexOf("casaservices") !== -1) ||
       (path.indexOf("casascenes") !== -1) || (path.indexOf("casausers") !== -1)) {
      return "casa";
   }

   return null;
}

function isSourceLikeObject(_obj) {

   if (!isObject(_obj)) {
      return false;
   }

   if (!((_obj.name && (typeof _obj.name === "string")) || (_obj.uName && (typeof _obj.uName === "string")))) {
      return false;
   }

   var type = _obj.type ? _obj.type.toLowerCase() : null;

   if ((type === "gang") || (type === "casa") || (type === "peercasa") || (type === "offlinecasa")) {
      return false;
   }

   if ((type === "property") || (type === "event") || (type === "sourcelistener")) {
      return false;
   }

   if ((_obj.hasOwnProperty("things") || _obj.hasOwnProperty("services") || _obj.hasOwnProperty("scenes") || _obj.hasOwnProperty("users")) &&
       !_obj.hasOwnProperty("priority") && !_obj.hasOwnProperty("properties") && !_obj.hasOwnProperty("events")) {
      return false;
   }

   return _obj.hasOwnProperty("priority") ||
          _obj.hasOwnProperty("properties") ||
          _obj.hasOwnProperty("events") ||
          _obj.hasOwnProperty("myNamedObjects") ||
          _obj.hasOwnProperty("type") ||
          _obj.hasOwnProperty("local") ||
          _obj.hasOwnProperty("_db") ||
          _obj.hasOwnProperty("remove") ||
          _obj.hasOwnProperty("delete") ||
          _obj.hasOwnProperty("_delete");
}

function defaultOwnerCasaForScope(_scope, _context) {

   if (_scope === "gang") {
      return "*";
   }

   return (_context && _context.targetCasaName) ? _context.targetCasaName :
          (_context && _context.defaultCasaName) ? _context.defaultCasaName : null;
}

function buildOperation(_sourceUName, _action, _scope, _ownerCasa, _patch, _path) {
   return {
      sourceUName: _sourceUName,
      action: (_action === "remove") ? "remove" : "upsert",
      scope: _scope,
      ownerCasa: _ownerCasa,
      patch: _patch ? _patch : {},
      path: _path
   };
}

var EXPLICIT_ALLOWED_SCOPE = {
   gang: true,
   casa: true,
   runtime: true,
   "external-casa": true
};

var EXPLICIT_ALLOWED_ACTION = {
   upsert: true,
   remove: true
};

var EXPLICIT_ALLOWED_FIELDS = {
   action: true,
   op: true,
   sourceUName: true,
   uName: true,
   name: true,
   scope: true,
   ownerCasa: true,
   casa: true,
   patch: true,
   priority: true,
   type: true,
   superType: true,
   local: true,
   _db: true,
   connected: true,
   providerType: true,
   remove: true,
   delete: true,
   _delete: true
};

function describeType(_value) {

   if (_value === null) {
      return "null";
   }

   if (_value instanceof Array) {
      return "array";
   }

   return typeof _value;
}

function validateOperationEntry(_entry, _index, _errors) {
   var prefix = "Invalid operation at index " + _index + ": ";

   if (!isObject(_entry)) {
      _errors.push(prefix + "entry must be an object");
      return false;
   }

   for (var key in _entry) {

      if (_entry.hasOwnProperty(key) && !EXPLICIT_ALLOWED_FIELDS.hasOwnProperty(key)) {
         _errors.push(prefix + "unknown field \"" + key + "\"");
      }
   }

   if (_entry.hasOwnProperty("patch") && !isObject(_entry.patch)) {
      _errors.push(prefix + "patch must be an object");
   }

   if (_entry.hasOwnProperty("scope")) {

      if (typeof _entry.scope !== "string") {
         _errors.push(prefix + "scope must be a string");
      }
      else {
         var scopeLower = _entry.scope.toLowerCase();

         if (!EXPLICIT_ALLOWED_SCOPE.hasOwnProperty(scopeLower)) {
            _errors.push(prefix + "scope must be one of gang|casa|runtime|external-casa");
         }
      }
   }

   if (_entry.hasOwnProperty("action")) {

      if (typeof _entry.action !== "string") {
         _errors.push(prefix + "action must be a string");
      }
      else if (!EXPLICIT_ALLOWED_ACTION.hasOwnProperty(_entry.action.toLowerCase())) {
         _errors.push(prefix + "action must be upsert or remove");
      }
   }

   if (_entry.hasOwnProperty("op")) {

      if (typeof _entry.op !== "string") {
         _errors.push(prefix + "op must be a string");
      }
      else if (!EXPLICIT_ALLOWED_ACTION.hasOwnProperty(_entry.op.toLowerCase())) {
         _errors.push(prefix + "op must be upsert or remove");
      }
   }

   if (_entry.hasOwnProperty("sourceUName") && (typeof _entry.sourceUName !== "string")) {
      _errors.push(prefix + "sourceUName must be a string");
   }

   if (_entry.hasOwnProperty("uName") && (typeof _entry.uName !== "string")) {
      _errors.push(prefix + "uName must be a string");
   }

   if (_entry.hasOwnProperty("name") && (typeof _entry.name !== "string")) {
      _errors.push(prefix + "name must be a string");
   }

   if (_entry.hasOwnProperty("ownerCasa") && (typeof _entry.ownerCasa !== "string")) {
      _errors.push(prefix + "ownerCasa must be a string");
   }

   if (_entry.hasOwnProperty("casa") && (typeof _entry.casa !== "string")) {
      _errors.push(prefix + "casa must be a string");
   }

   if (_entry.hasOwnProperty("priority")) {

      if ((typeof _entry.priority !== "number") || !isFinite(_entry.priority)) {
         _errors.push(prefix + "priority must be a finite number");
      }
   }

   if (_entry.hasOwnProperty("type") && (typeof _entry.type !== "string")) {
      _errors.push(prefix + "type must be a string");
   }

   if (_entry.hasOwnProperty("superType") && (typeof _entry.superType !== "string")) {
      _errors.push(prefix + "superType must be a string");
   }

   if (_entry.hasOwnProperty("_db") && (typeof _entry._db !== "string")) {
      _errors.push(prefix + "_db must be a string");
   }

   if (_entry.hasOwnProperty("providerType") && (typeof _entry.providerType !== "string")) {
      _errors.push(prefix + "providerType must be a string");
   }

   if (_entry.hasOwnProperty("local") && (typeof _entry.local !== "boolean")) {
      _errors.push(prefix + "local must be a boolean");
   }

   if (_entry.hasOwnProperty("connected") && (typeof _entry.connected !== "boolean")) {
      _errors.push(prefix + "connected must be a boolean");
   }

   if (_entry.hasOwnProperty("remove") && (typeof _entry.remove !== "boolean")) {
      _errors.push(prefix + "remove must be a boolean");
   }

   if (_entry.hasOwnProperty("delete") && (typeof _entry.delete !== "boolean")) {
      _errors.push(prefix + "delete must be a boolean");
   }

   if (_entry.hasOwnProperty("_delete") && (typeof _entry._delete !== "boolean")) {
      _errors.push(prefix + "_delete must be a boolean");
   }

   var sourceName = _entry.sourceUName || _entry.uName || _entry.name;

   if (!sourceName || (typeof sourceName !== "string") || (sourceName.trim().length === 0)) {
      _errors.push(prefix + "source name is required via sourceUName|uName|name");
   }

   return _errors.length === 0;
}

function parseExplicitOperations(_patch, _operations, _warnings, _errors, _context) {
   var explicit = null;
   var hasChanges = !!(_patch && _patch.hasOwnProperty("changes"));
   var hasOperations = !!(_patch && _patch.hasOwnProperty("operations"));

   if (hasChanges && hasOperations) {
      _errors.push("Patch cannot contain both \"changes\" and \"operations\"; choose one");
      return { explicitMode: true, explicitCount: 0 };
   }

   if (hasChanges) {

      if (!(_patch.changes instanceof Array)) {
         _errors.push("Patch field \"changes\" must be an array");
         return { explicitMode: true, explicitCount: 0 };
      }

      explicit = _patch.changes;
   }
   else if (hasOperations) {

      if (!(_patch.operations instanceof Array)) {
         _errors.push("Patch field \"operations\" must be an array");
         return { explicitMode: true, explicitCount: 0 };
      }

      explicit = _patch.operations;
   }

   if (!explicit) {
      return { explicitMode: false, explicitCount: 0 };
   }

   var added = 0;

   for (var i = 0; i < explicit.length; ++i) {
      var entry = explicit[i];
      var startingErrors = _errors.length;

      validateOperationEntry(entry, i, _errors);

      if (_errors.length > startingErrors) {
         continue;
      }

      var sourceUName = normaliseSourceUName(entry.sourceUName || entry.uName || entry.name);
      var scope = entry.scope ? String(entry.scope).toLowerCase() : (_context.mode === "gang" ? "gang" : "casa");
      var ownerCasa = entry.casa || entry.ownerCasa || defaultOwnerCasaForScope(scope, _context);
      var action = entry.action || entry.op || ((entry.remove || entry.delete || entry._delete) ? "remove" : "upsert");
      var patch = isObject(entry.patch) ? deepCopy(entry.patch) : {};

      if (entry.hasOwnProperty("priority")) patch.priority = entry.priority;
      if (entry.hasOwnProperty("type")) patch.type = entry.type;
      if (entry.hasOwnProperty("superType")) patch.superType = entry.superType;
      if (entry.hasOwnProperty("local")) patch.local = !!entry.local;
      if (entry.hasOwnProperty("_db")) patch._db = entry._db;
      if (entry.hasOwnProperty("connected")) patch.connected = !!entry.connected;
      if (entry.hasOwnProperty("providerType")) patch.providerType = entry.providerType;
      if (entry.hasOwnProperty("scope")) patch.scope = entry.scope;

      _operations.push(buildOperation(sourceUName, action, scope, ownerCasa, patch, "changes[" + i + "]"));
      ++added;
   }

   return { explicitMode: true, explicitCount: added };
}

function traverseConfigPatch(_node, _scope, _ownerCasa, _path, _nameParts, _operations) {

   if (_node instanceof Array) {

      for (var i = 0; i < _node.length; ++i) {
         traverseConfigPatch(_node[i], _scope, _ownerCasa, _path + "[" + i + "]", _nameParts, _operations);
      }

      return;
   }

   if (!isObject(_node)) {
      return;
   }

   var pathNameParts = _nameParts;
   var isSource = isSourceLikeObject(_node);

   if (isSource) {
      var sourceUName = _node.uName ? normaliseSourceUName(_node.uName) : normaliseSourceUName(_nameParts.concat([_node.name]).join(":"));
      var sourceNameParts = _node.uName ? splitUNameParts(_node.uName) : _nameParts.concat([_node.name]);
      var action = (_node.remove || _node.delete || _node._delete) ? "remove" : "upsert";
      var patch = {};

      if (_node.hasOwnProperty("priority")) patch.priority = _node.priority;
      if (_node.hasOwnProperty("type")) patch.type = _node.type;
      if (_node.hasOwnProperty("superType")) patch.superType = _node.superType;
      if (_node.hasOwnProperty("local")) patch.local = !!_node.local;
      if (_node.hasOwnProperty("_db")) patch._db = _node._db;
      if (_node.hasOwnProperty("connected")) patch.connected = !!_node.connected;
      if (_node.hasOwnProperty("providerType")) patch.providerType = _node.providerType;
      if (_node.hasOwnProperty("scope")) patch.scope = _node.scope;

      if (sourceUName) {
         _operations.push(buildOperation(sourceUName, action, _scope, _ownerCasa, patch, _path));
      }

      pathNameParts = sourceNameParts;
   }

   for (var key in _node) {

      if (_node.hasOwnProperty(key) && (isObject(_node[key]) || (_node[key] instanceof Array))) {
         traverseConfigPatch(_node[key], _scope, _ownerCasa, _path + "." + key, pathNameParts, _operations);
      }
   }
}

function parseImplicitOperations(_patch, _operations, _context) {
   var recognised = false;

   for (var key in _patch) {

      if (_patch.hasOwnProperty(key)) {
         var scope = deriveScopeFromPath(key);

         if (scope) {
            recognised = true;
            var ownerCasa = defaultOwnerCasaForScope(scope, _context);
            traverseConfigPatch(_patch[key], scope, ownerCasa, key, [], _operations);
         }
      }
   }

   if (!recognised) {
      var fallbackScope = (_context.mode === "gang") ? "gang" : "casa";
      var fallbackOwnerCasa = defaultOwnerCasaForScope(fallbackScope, _context);
      traverseConfigPatch(_patch, fallbackScope, fallbackOwnerCasa, "patch", [], _operations);
   }
}

function collectOperations(_patch, _warnings, _errors, _context) {
   var operations = [];
   var explicitResult = parseExplicitOperations(_patch, operations, _warnings, _errors, _context);

   if (!explicitResult.explicitMode) {
      parseImplicitOperations(_patch, operations, _context);
   }

   return operations;
}

function collectAllCasaNames(_context) {
   var casaNames = {};
   var gang = _context.gang;

   if (_context.defaultCasaName) {
      casaNames[_context.defaultCasaName] = true;
   }

   if (gang && gang.casa && gang.casa.name) {
      casaNames[gang.casa.name] = true;
   }

   if (gang && gang.peercasas) {

      for (var peerCasaName in gang.peercasas) {

         if (gang.peercasas.hasOwnProperty(peerCasaName)) {
            casaNames[peerCasaName] = true;
         }
      }
   }

   return Object.keys(casaNames).sort();
}

function ensureOperationDefaults(_operations, _context) {

   for (var i = 0; i < _operations.length; ++i) {
      var op = _operations[i];

      if (!op.ownerCasa) {
         op.ownerCasa = defaultOwnerCasaForScope(op.scope, _context);
      }

      if (!op.scope) {
         op.scope = (_context.mode === "gang") ? "gang" : "casa";
      }
   }
}

function collectImpactedSourceUNames(_operations) {
   var sourceUNames = {};

   for (var i = 0; i < _operations.length; ++i) {
      sourceUNames[_operations[i].sourceUName] = true;
   }

   return Object.keys(sourceUNames).sort();
}

function instanceIdentityKey(_instance) {
   return (_instance.ownerCasa || "") + "|" + (_instance.providerType || "") + "|" + ((_instance.priority !== undefined) ? _instance.priority : 0) + "|" + (_instance.type || "");
}

function ownerProviderKey(_instance) {
   return (_instance.ownerCasa || "") + "|" + (_instance.providerType || "");
}

function findUsageMatch(_usageInstances, _instance) {
   var i;

   for (i = 0; i < _usageInstances.length; ++i) {

      if ((_usageInstances[i].ownerCasa === _instance.ownerCasa) &&
          (_usageInstances[i].providerType === _instance.providerType) &&
          (_usageInstances[i].priority === _instance.priority)) {
         return _usageInstances[i];
      }
   }

   for (i = 0; i < _usageInstances.length; ++i) {

      if ((_usageInstances[i].ownerCasa === _instance.ownerCasa) &&
          (_usageInstances[i].providerType === _instance.providerType)) {
         return _usageInstances[i];
      }
   }

   return null;
}

function buildVirtualInstances(_beforeResolve, _beforeUsage) {
   var instances = [];
   var usageInstances = (_beforeUsage && _beforeUsage.instances) ? _beforeUsage.instances : [];
   var resolvedInstances = (_beforeResolve && _beforeResolve.instances) ? _beforeResolve.instances : [];

   for (var i = 0; i < resolvedInstances.length; ++i) {
      var instance = deepCopy(resolvedInstances[i]);
      var usage = findUsageMatch(usageInstances, instance);

      instance.consumerCount = usage ? usage.consumerCount : 0;
      instance.subscriptionCount = usage ? usage.subscriptionCount : 0;
      instance.consumers = usage && usage.consumers ? deepCopy(usage.consumers) : [];

      instances.push(instance);
   }

   return instances;
}

function inferProviderType(_ownerCasa, _defaultCasaName) {
   return (_ownerCasa === _defaultCasaName) ? "casa" : "peercasa";
}

function inferScope(_patch, _providerType, _gangName, _defaultCasaName) {

   if (_patch && _patch.scope) {
      return _patch.scope;
   }

   var ownerDb = _patch ? _patch._db : null;

   if (ownerDb === _gangName) {
      return "gang";
   }
   else if (ownerDb === _defaultCasaName) {
      return "casa";
   }
   else if (ownerDb) {
      return "external-casa";
   }

   return (_providerType === "peercasa") ? "runtime" : "casa";
}

function applyOperationToInstances(_instances, _operation, _context, _allCasaNames) {
   var ownerCasas = (_operation.ownerCasa === "*") ? _allCasaNames : [ _operation.ownerCasa ];

   for (var i = 0; i < ownerCasas.length; ++i) {
      var ownerCasa = ownerCasas[i];

      if (!ownerCasa) {
         continue;
      }

      var providerType = (_operation.patch && _operation.patch.providerType) ? _operation.patch.providerType :
                         inferProviderType(ownerCasa, _context.defaultCasaName);

      if (_operation.action === "remove") {

         for (var j = 0; j < _instances.length;) {

            if ((_instances[j].ownerCasa === ownerCasa) &&
                ((!_operation.patch.providerType) || (_instances[j].providerType === providerType))) {
               _instances.splice(j, 1);
            }
            else {
               ++j;
            }
         }

         continue;
      }

      var existing = null;
      var k;

      for (k = 0; k < _instances.length; ++k) {

         if ((_instances[k].ownerCasa === ownerCasa) && (_instances[k].providerType === providerType)) {
            existing = _instances[k];
            break;
         }
      }

      if (!existing) {
         existing = {
            ownerCasa: ownerCasa,
            providerType: providerType,
            type: (_operation.patch && _operation.patch.type) ? _operation.patch.type : "unknown",
            superType: (_operation.patch && _operation.patch.superType) ? _operation.patch.superType : null,
            priority: (_operation.patch && _operation.patch.hasOwnProperty("priority")) ? _operation.patch.priority : 0,
            state: "standby",
            inSourcesMap: true,
            inBowingMap: false,
            connected: (_operation.patch && _operation.patch.hasOwnProperty("connected")) ? !!_operation.patch.connected : true,
            scope: inferScope(_operation.patch, providerType, _context.gangName, _context.defaultCasaName),
            consumerCount: 0,
            subscriptionCount: 0,
            consumers: []
         };

         _instances.push(existing);
      }

      if (_operation.patch) {
         if (_operation.patch.hasOwnProperty("type")) existing.type = _operation.patch.type;
         if (_operation.patch.hasOwnProperty("superType")) existing.superType = _operation.patch.superType;
         if (_operation.patch.hasOwnProperty("priority")) existing.priority = _operation.patch.priority;
         if (_operation.patch.hasOwnProperty("connected")) existing.connected = !!_operation.patch.connected;
         if (_operation.patch.hasOwnProperty("inSourcesMap")) existing.inSourcesMap = !!_operation.patch.inSourcesMap;
         if (_operation.patch.hasOwnProperty("inBowingMap")) existing.inBowingMap = !!_operation.patch.inBowingMap;
         existing.scope = inferScope(_operation.patch, existing.providerType, _context.gangName, _context.defaultCasaName);
      }
   }
}

function chooseActiveIndex(_instances) {
   var winnerIndex = -1;

   for (var i = 0; i < _instances.length; ++i) {
      var instance = _instances[i];

      if (!instance.connected) {
         continue;
      }

      if (winnerIndex === -1) {
         winnerIndex = i;
         continue;
      }

      var winner = _instances[winnerIndex];
      var instancePriority = (instance.priority !== undefined) ? instance.priority : 0;
      var winnerPriority = (winner.priority !== undefined) ? winner.priority : 0;

      if (instancePriority > winnerPriority) {
         winnerIndex = i;
      }
      else if ((instancePriority === winnerPriority) &&
               ((instance.ownerCasa || "") < (winner.ownerCasa || ""))) {
         winnerIndex = i;
      }
   }

   return winnerIndex;
}

function finaliseInstances(_instances) {
   var winnerIndex = chooseActiveIndex(_instances);

   for (var i = 0; i < _instances.length; ++i) {
      var instance = _instances[i];

      if (!instance.connected) {
         instance.state = "unavailable";
         instance.inBowingMap = false;
      }
      else if (i === winnerIndex) {
         instance.state = "active";
         instance.inBowingMap = false;
      }
      else {
         instance.state = "bowed";
         instance.inBowingMap = true;
      }

      instance.inSourcesMap = true;
   }

   _instances.sort( (_a, _b) => {
      var aPriority = (_a.priority !== undefined) ? _a.priority : 0;
      var bPriority = (_b.priority !== undefined) ? _b.priority : 0;

      if (aPriority > bPriority) {
         return -1;
      }
      else if (aPriority < bPriority) {
         return 1;
      }
      else if ((_a.ownerCasa || "") > (_b.ownerCasa || "")) {
         return 1;
      }
      else if ((_a.ownerCasa || "") < (_b.ownerCasa || "")) {
         return -1;
      }

      return 0;
   });
}

function buildResolveSnapshot(_sourceUName, _instances) {
   var activeOwnerCasa = null;
   var activeProviderType = null;
   var outputInstances = [];

   for (var i = 0; i < _instances.length; ++i) {
      var instance = _instances[i];

      if (instance.state === "active") {
         activeOwnerCasa = instance.ownerCasa;
         activeProviderType = instance.providerType;
      }

      outputInstances.push({
         ownerCasa: instance.ownerCasa,
         providerType: instance.providerType,
         type: instance.type,
         superType: instance.superType,
         priority: instance.priority,
         state: instance.state,
         inSourcesMap: !!instance.inSourcesMap,
         inBowingMap: !!instance.inBowingMap,
         connected: !!instance.connected,
         scope: instance.scope
      });
   }

   return {
      sourceUName: _sourceUName,
      exists: outputInstances.length > 0,
      activeOwnerCasa: activeOwnerCasa,
      activeProviderType: activeProviderType,
      instances: outputInstances
   };
}

function buildUsageSnapshot(_sourceUName, _resolveSnapshot, _instances) {
   var usageInstances = [];
   var consumerSet = {};
   var subscriptionCount = 0;

   for (var i = 0; i < _instances.length; ++i) {
      var instance = _instances[i];
      subscriptionCount += instance.subscriptionCount ? instance.subscriptionCount : 0;

      for (var c = 0; c < instance.consumers.length; ++c) {
         consumerSet[instance.consumers[c].sourceUName] = true;
      }

      usageInstances.push({
         ownerCasa: instance.ownerCasa,
         providerType: instance.providerType,
         type: instance.type,
         superType: instance.superType,
         priority: instance.priority,
         state: instance.state,
         connected: !!instance.connected,
         inSourcesMap: !!instance.inSourcesMap,
         inBowingMap: !!instance.inBowingMap,
         scope: instance.scope,
         consumerCount: instance.consumerCount ? instance.consumerCount : 0,
         subscriptionCount: instance.subscriptionCount ? instance.subscriptionCount : 0,
         consumers: deepCopy(instance.consumers)
      });
   }

   return {
      sourceUName: _sourceUName,
      exists: _resolveSnapshot.exists,
      activeOwnerCasa: _resolveSnapshot.activeOwnerCasa,
      activeProviderType: _resolveSnapshot.activeProviderType,
      instanceCount: usageInstances.length,
      consumerCount: Object.keys(consumerSet).length,
      subscriptionCount: subscriptionCount,
      filters: { activeOnly: false, hasConsumers: false },
      instances: usageInstances
   };
}

function diffSnapshots(_beforeResolve, _afterResolve, _beforeUsage, _afterUsage) {
   var delta = {
      changed: false,
      activeOwnerChanged: (_beforeResolve.activeOwnerCasa !== _afterResolve.activeOwnerCasa) ||
                          (_beforeResolve.activeProviderType !== _afterResolve.activeProviderType),
      beforeActiveOwnerCasa: _beforeResolve.activeOwnerCasa,
      afterActiveOwnerCasa: _afterResolve.activeOwnerCasa,
      beforeActiveProviderType: _beforeResolve.activeProviderType,
      afterActiveProviderType: _afterResolve.activeProviderType,
      instanceStateChanges: [],
      addedInstances: [],
      removedInstances: [],
      usageChanged: false
   };
   var beforeMap = {};
   var afterMap = {};
   var i;

   for (i = 0; i < _beforeResolve.instances.length; ++i) {
      beforeMap[instanceIdentityKey(_beforeResolve.instances[i])] = _beforeResolve.instances[i];
   }

   for (i = 0; i < _afterResolve.instances.length; ++i) {
      afterMap[instanceIdentityKey(_afterResolve.instances[i])] = _afterResolve.instances[i];
   }

   for (var beforeKey in beforeMap) {

      if (beforeMap.hasOwnProperty(beforeKey)) {

         if (!afterMap.hasOwnProperty(beforeKey)) {
            delta.removedInstances.push(beforeMap[beforeKey]);
            continue;
         }

         if (beforeMap[beforeKey].state !== afterMap[beforeKey].state) {
            delta.instanceStateChanges.push({
               ownerCasa: beforeMap[beforeKey].ownerCasa,
               providerType: beforeMap[beforeKey].providerType,
               priority: beforeMap[beforeKey].priority,
               from: beforeMap[beforeKey].state,
               to: afterMap[beforeKey].state
            });
         }
      }
   }

   for (var afterKey in afterMap) {

      if (afterMap.hasOwnProperty(afterKey) && !beforeMap.hasOwnProperty(afterKey)) {
         delta.addedInstances.push(afterMap[afterKey]);
      }
   }

   if (_beforeUsage && _afterUsage) {
      delta.usageChanged = (_beforeUsage.consumerCount !== _afterUsage.consumerCount) ||
                          (_beforeUsage.subscriptionCount !== _afterUsage.subscriptionCount);
   }

   delta.changed = delta.activeOwnerChanged ||
                   (delta.instanceStateChanges.length > 0) ||
                   (delta.addedInstances.length > 0) ||
                   (delta.removedInstances.length > 0) ||
                   delta.usageChanged;

   return delta;
}

function previewSource(_sourceUName, _operations, _context, _includeUsage, _allCasaNames) {
   var beforeResolve = _context.resolveSourceFn(_sourceUName);
   var beforeUsage = _includeUsage ? _context.sourceUsageFn(_sourceUName, { activeOnly: false, hasConsumers: false }) : null;
   var virtualInstances = buildVirtualInstances(beforeResolve, beforeUsage);

   for (var i = 0; i < _operations.length; ++i) {
      applyOperationToInstances(virtualInstances, _operations[i], _context, _allCasaNames);
   }

   finaliseInstances(virtualInstances);

   var afterResolve = buildResolveSnapshot(_sourceUName, virtualInstances);
   var afterUsage = _includeUsage ? buildUsageSnapshot(_sourceUName, afterResolve, virtualInstances) : null;
   var delta = diffSnapshots(beforeResolve, afterResolve, beforeUsage, afterUsage);

   return {
      sourceUName: _sourceUName,
      before: {
         resolve: beforeResolve,
         usage: beforeUsage
      },
      after: {
         resolve: afterResolve,
         usage: afterUsage
      },
      delta: delta
   };
}

function collectSummary(_items, _truncated) {
   var summary = {
      impactedSourceCount: _items.length,
      changedSourceCount: 0,
      changedActiveOwnerCount: 0,
      changedStateCount: 0,
      addedSourceCount: 0,
      removedSourceCount: 0,
      addedInstanceCount: 0,
      removedInstanceCount: 0,
      truncated: !!_truncated
   };

   for (var i = 0; i < _items.length; ++i) {
      var item = _items[i];
      var beforeExists = item.before && item.before.resolve ? !!item.before.resolve.exists : false;
      var afterExists = item.after && item.after.resolve ? !!item.after.resolve.exists : false;

      if (item.delta && item.delta.changed) {
         ++summary.changedSourceCount;
      }

      if (item.delta && item.delta.activeOwnerChanged) {
         ++summary.changedActiveOwnerCount;
      }

      if (item.delta) {
         summary.changedStateCount += item.delta.instanceStateChanges.length;
         summary.addedInstanceCount += item.delta.addedInstances.length;
         summary.removedInstanceCount += item.delta.removedInstances.length;
      }

      if (!beforeExists && afterExists) {
         ++summary.addedSourceCount;
      }
      else if (beforeExists && !afterExists) {
         ++summary.removedSourceCount;
      }
   }

   return summary;
}

function toInt(_value, _default) {
   var n = parseInt(_value);
   return (!n || (n < 0)) ? _default : n;
}

function toOptionalNonNegativeInt(_value, _defaultValue) {

   if ((_value === undefined) || (_value === null)) {
      return _defaultValue;
   }

   var n = parseInt(_value);

   if (!isFinite(n) || (n < 0)) {
      return null;
   }

   return n;
}

function preparePreview(_input, _context) {
   var errors = [];
   var warnings = [];
   var context = _context ? _context : {};
   var options = isObject(_input) ? _input : {};
   var includeUsage = !!options.includeUsage;
   var limit = toInt(options.limit, 200);
   var summaryOnly = !!options.summaryOnly;
   var topChanged = toOptionalNonNegativeInt(options.topChanged, 0);
   var patch = parsePatchInput(options.patch, errors);
   var operations;
   var impactedSourceUNames;
   var allCasaNames = collectAllCasaNames(context);
   var truncated = false;

   if (!context || (typeof context.resolveSourceFn !== "function") || (typeof context.sourceUsageFn !== "function")) {
      errors.push("Preview engine context is missing source resolver hooks");
   }

   if (options.hasOwnProperty("includeUsage") && (typeof options.includeUsage !== "boolean")) {
      errors.push("includeUsage must be a boolean");
   }

   if (options.hasOwnProperty("limit") && (((typeof options.limit !== "number") || !isFinite(options.limit)) || (options.limit < 0))) {
      errors.push("limit must be a non-negative number");
   }

   if (options.hasOwnProperty("targetCasaName") && (typeof options.targetCasaName !== "string")) {
      errors.push("targetCasaName must be a string");
   }

   if (options.hasOwnProperty("summaryOnly") && (typeof options.summaryOnly !== "boolean")) {
      errors.push("summaryOnly must be a boolean");
   }

   if ((topChanged === null) ||
       (options.hasOwnProperty("topChanged") && (((typeof options.topChanged !== "number") || !isFinite(options.topChanged)) || (options.topChanged < 0)))) {
      errors.push("topChanged must be a non-negative number");
   }

   if (errors.length > 0) {
      return { ok: false, errors: errors, warnings: warnings };
   }

   if (summaryOnly && (topChanged > 0)) {
      warnings.push("summaryOnly=true overrides topChanged");
      topChanged = 0;
   }

   operations = collectOperations(patch, warnings, errors, {
      mode: context.mode,
      defaultCasaName: context.defaultCasaName,
      targetCasaName: options.targetCasaName ? options.targetCasaName : context.targetCasaName
   });

   if (errors.length > 0) {
      return { ok: false, errors: errors, warnings: warnings };
   }

   ensureOperationDefaults(operations, {
      mode: context.mode,
      defaultCasaName: context.defaultCasaName,
      targetCasaName: options.targetCasaName ? options.targetCasaName : context.targetCasaName
   });

   impactedSourceUNames = collectImpactedSourceUNames(operations);

   if (impactedSourceUNames.length === 0) {
      warnings.push("No impacted sources were detected from patch input");
   }

   if (limit && (impactedSourceUNames.length > limit)) {
      impactedSourceUNames = impactedSourceUNames.slice(0, limit);
      truncated = true;
      warnings.push("Impacted source list truncated to limit=" + limit);
   }

   var operationsBySource = {};

   for (var i = 0; i < operations.length; ++i) {
      var op = operations[i];

      if (!operationsBySource[op.sourceUName]) {
         operationsBySource[op.sourceUName] = [];
      }

      operationsBySource[op.sourceUName].push(op);
   }

   return {
      ok: true,
      warnings: warnings,
      errors: [],
      options: options,
      includeUsage: includeUsage,
      limit: limit,
      summaryOnly: summaryOnly,
      topChanged: topChanged,
      truncated: truncated,
      allCasaNames: allCasaNames,
      impactedSourceUNames: impactedSourceUNames,
      operationsBySource: operationsBySource,
      previewContext: {
         gang: context.gang,
         mode: context.mode,
         gangName: context.gangName,
         defaultCasaName: context.defaultCasaName,
         targetCasaName: options.targetCasaName ? options.targetCasaName : context.targetCasaName,
         resolveSourceFn: context.resolveSourceFn,
         sourceUsageFn: context.sourceUsageFn
      }
   };
}

function selectImpactedSourcesForOutput(_prepared, _previewItems, _summary, _warnings) {
   var mode = "full";
   var impacted = _previewItems;
   var changedReturnedCount = _summary.changedSourceCount;

   if (_prepared.summaryOnly) {
      mode = "summary";
      impacted = [];
      changedReturnedCount = 0;
   }
   else if (_prepared.topChanged > 0) {
      mode = "top-changed";
      impacted = [];
      changedReturnedCount = 0;

      for (var i = 0; i < _previewItems.length; ++i) {

         if (_previewItems[i] && _previewItems[i].delta && _previewItems[i].delta.changed) {
            ++changedReturnedCount;
            impacted.push(_previewItems[i]);

            if (impacted.length >= _prepared.topChanged) {
               break;
            }
         }
      }

      if (_summary.changedSourceCount > impacted.length) {
         _warnings.push("Changed source details truncated to topChanged=" + _prepared.topChanged);
      }
   }

   return {
      mode: mode,
      impactedSources: impacted,
      impactedReturnedCount: impacted.length,
      impactedTotalCount: _previewItems.length,
      changedReturnedCount: changedReturnedCount,
      changedTotalCount: _summary.changedSourceCount
   };
}

function buildPreviewResult(_prepared, _previewItems) {
   var warnings = _prepared.warnings ? _prepared.warnings.slice(0) : [];
   var summary = collectSummary(_previewItems, _prepared.truncated);
   var selection = selectImpactedSourcesForOutput(_prepared, _previewItems, summary, warnings);

   return {
      ok: true,
      scope: {
         mode: _prepared.previewContext.mode ? _prepared.previewContext.mode : "casa",
         targetCasa: _prepared.previewContext.targetCasaName ? _prepared.previewContext.targetCasaName : _prepared.previewContext.defaultCasaName
      },
      summary: summary,
      output: {
         mode: selection.mode,
         impactedReturnedCount: selection.impactedReturnedCount,
         impactedTotalCount: selection.impactedTotalCount,
         changedReturnedCount: selection.changedReturnedCount,
         changedTotalCount: selection.changedTotalCount
      },
      impactedSources: selection.impactedSources,
      warnings: warnings,
      errors: []
   };
}

function previewConfig(_input, _context) {
   var prepared = preparePreview(_input, _context);
   var previewItems = [];
   var impactedSourceUNames = null;

   if (!prepared.ok) {
      return { ok: false, errors: prepared.errors, warnings: prepared.warnings, summary: null, impactedSources: [] };
   }

   impactedSourceUNames = prepared.impactedSourceUNames ? prepared.impactedSourceUNames : [];

   for (var i = 0; i < impactedSourceUNames.length; ++i) {
      var sourceUName = impactedSourceUNames[i];
      var sourceOperations = prepared.operationsBySource[sourceUName] ? prepared.operationsBySource[sourceUName] : [];
      previewItems.push(previewSource(sourceUName, sourceOperations, prepared.previewContext, prepared.includeUsage, prepared.allCasaNames));
   }

   return buildPreviewResult(prepared, previewItems);
}

function previewConfigAsync(_input, _context, _progressCb, _completeCb) {
   var progressCb = (typeof _progressCb === "function") ? _progressCb : null;
   var completeCb = (typeof _completeCb === "function") ? _completeCb : function() {};
   var prepared = preparePreview(_input, _context);

   if (!prepared.ok) {
      return completeCb({ ok: false, errors: prepared.errors, warnings: prepared.warnings, summary: null, impactedSources: [] });
   }

   var previewItems = [];
   var total = prepared.impactedSourceUNames.length;
   var processed = 0;
   var chunkSize = 25;

   if (progressCb) {
      progressCb({ event: "preview-started", total: total, processed: 0, percent: 0 });
   }

   if (total === 0) {
      var emptyResult = buildPreviewResult(prepared, previewItems);

      if (progressCb) {
         progressCb({ event: "preview-complete", total: 0, processed: 0, percent: 100, changedSourceCount: 0 });
      }

      return completeCb(emptyResult);
   }

   var processChunk = function() {
      var end = Math.min(processed + chunkSize, total);

      for (; processed < end; ++processed) {
         var sourceUName = prepared.impactedSourceUNames[processed];
         var sourceOperations = prepared.operationsBySource[sourceUName] ? prepared.operationsBySource[sourceUName] : [];
         previewItems.push(previewSource(sourceUName, sourceOperations, prepared.previewContext, prepared.includeUsage, prepared.allCasaNames));
      }

      if (progressCb) {
         progressCb({
            event: "preview-progress",
            total: total,
            processed: processed,
            percent: Math.floor((processed * 100) / total)
         });
      }

      if (processed < total) {
         return setImmediate(processChunk);
      }

      var result = buildPreviewResult(prepared, previewItems);

      if (progressCb) {
         progressCb({
            event: "preview-complete",
            total: total,
            processed: total,
            percent: 100,
            changedSourceCount: result.summary ? result.summary.changedSourceCount : 0
         });
      }

      return completeCb(result);
   };

   setImmediate(processChunk);
}

module.exports = exports = {
   previewConfig: previewConfig,
   previewConfigAsync: previewConfigAsync
};
