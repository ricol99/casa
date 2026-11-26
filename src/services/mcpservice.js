var util = require('util');
var WebService = require('./webservice');
var crypto = require('crypto');
var https = require('https');
var http = require('http');
var url = require('url');
var BuildingConsoleApi = require('../consoleapis/buildingconsoleapi');

var MCP_PROTOCOL_VERSION = "2025-06-18";

function McpService(_config, _owner) {
   _config.socketIoSupported = false;
   WebService.call(this, _config, _owner);

   this.mcpRoute = _config.hasOwnProperty("mcpRoute") ? _config.mcpRoute : "/mcp";
   this.maxBodyBytes = _config.hasOwnProperty("maxBodyBytes") ? _config.maxBodyBytes : 1024 * 1024;
   this.auth = _config.hasOwnProperty("auth") ? _config.auth : { mode: "none" };
   this.supportedProtocolVersions = _config.hasOwnProperty("supportedProtocolVersions")
      ? _config.supportedProtocolVersions
      : [ MCP_PROTOCOL_VERSION ];
   this.jwks = { keysByKid: {}, expiresAt: 0 };
   this.jwksCacheTtl = this.auth && this.auth.jwksCacheTtl ? this.auth.jwksCacheTtl : 3600;
}

util.inherits(McpService, WebService);

// Called when current state required
McpService.prototype.export = function(_exportObj) {
   WebService.prototype.export.call(this, _exportObj);
};

// Called when current state required
McpService.prototype.import = function(_importObj) {
   WebService.prototype.import.call(this, _importObj);
};

McpService.prototype.coldStart = function() {
   WebService.prototype.coldStart.call(this);
};

McpService.prototype.hotStart = function() {
   WebService.prototype.hotStart.call(this);
};

McpService.prototype.start = function() {
   WebService.prototype.start.call(this);

   this.addRoute("/.well-known/oauth-protected-resource", McpService.prototype.handleProtectedResourceMetadata.bind(this));

   if (this.mcpRoute !== "/") {
      this.addRoute("/.well-known/oauth-protected-resource" + this.mcpRoute, McpService.prototype.handleProtectedResourceMetadata.bind(this));
   }

   this.addRoute(this.mcpRoute, McpService.prototype.handleGet.bind(this));
   this.addRoute(this.mcpRoute + "/.well-known/oauth-authorization-server", McpService.prototype.handleOauthMetadata.bind(this));
   this.addRoute(this.mcpRoute + "/oauth", McpService.prototype.handleOauthPlaceholder.bind(this));
   this.addPostRoute(this.mcpRoute, McpService.prototype.handlePost.bind(this));
};

McpService.prototype.handleGet = function(_request, _response) {

   this.isAuthorized(_request, (ok) => {
      if (!ok && !(this.auth && this.auth.publicGet)) {
         console.log(this.uName + ": Unauthorized GET " + _request.url);
         return this.sendUnauthorized(_request, _response);
      }

      console.log(this.uName + ": GET " + _request.url);
      _response.status(200).json({
         name: "casa-mcp",
         status: "ok"
      });
   });
};

McpService.prototype.handlePost = function(_request, _response) {

   this.isAuthorized(_request, (ok) => {

      if (!ok) {
         console.log(this.uName + ": Unauthorized POST " + _request.url);
         return this.sendUnauthorized(_request, _response);
      }

      this.collectJsonBody(_request, (_err, _body) => {
         if (_err) {
            console.log(this.uName + ": Invalid JSON body for POST " + _request.url);
            return this.sendJsonRpcError(_response, null, -32700, "Invalid JSON");
         }

         console.log(this.uName + ": JSON-RPC " + (_body && _body.method ? _body.method : "unknown"));
         return this.handleJsonRpc(_body, _request, _response);
      });
   });
};

McpService.prototype.handleOauthMetadata = function(_request, _response) {
   var baseUrl = this.getBaseUrl(_request);
   var issuer = this.auth && this.auth.issuer ? this.auth.issuer : baseUrl;

   console.log(this.uName + ": OAuth metadata requested");
   _response.status(200).json({
      issuer: issuer,
      authorization_endpoint: issuer + "/authorize",
      token_endpoint: issuer + "/token",
      jwks_uri: issuer + "/jwks",
      response_types_supported: [ "code" ],
      grant_types_supported: [ "authorization_code", "refresh_token" ],
      token_endpoint_auth_methods_supported: [ "client_secret_post", "client_secret_basic" ],
      scopes_supported: this.auth && this.auth.scopes ? this.auth.scopes : [ "mcp" ]
   });
};

McpService.prototype.handleOauthPlaceholder = function(_request, _response) {

   console.log(this.uName + ": OAuth placeholder requested");
   _response.status(501).json({
      error: "not_implemented",
      message: "OAuth endpoints are placeholders. Configure auth.issuer and proxy to your OAuth provider."
   });
};

McpService.prototype.handleProtectedResourceMetadata = function(_request, _response) {
   var issuer = this.auth && this.auth.issuer ? this.auth.issuer : this.getBaseUrl(_request);
   var resource = this.getBaseUrl(_request) + this.mcpRoute;

   console.log(this.uName + ": Protected resource metadata requested");
   _response.status(200).json({
      resource: resource,
      authorization_servers: [ issuer ]
   });
};

McpService.prototype.collectJsonBody = function(_request, _callback) {
   var body = "";
   var received = 0;

   _request.on("data", (chunk) => {
      received += chunk.length;

      if (received > this.maxBodyBytes) {
         _request.destroy();
         return _callback(new Error("Body too large"));
      }

      body += chunk;
   });

   _request.on("end", () => {
      if (!body) {
         return _callback(null, {});
      }

      try {
         return _callback(null, JSON.parse(body));
      }
      catch (_err) {
         return _callback(_err);
      }
   });

   _request.on("error", (err) => _callback(err));
};

McpService.prototype.isAuthorized = function(_request, _callback) {
   var mode = this.auth && this.auth.mode ? this.auth.mode : "none";

   if (mode === "none") {
      console.log(this.uName + ": Auth mode none");
      return _callback(true);
   }

   var header = _request.headers ? _request.headers.authorization : null;
   var token = header ? header.replace(/^Bearer\s+/i, "") : null;

   if (token) {
      token = token.replace(/^\"|\"$/g, "").trim();
   }

   if (!token) {
      console.log(this.uName + ": Missing bearer token");
      return _callback(false);
   }

   console.log(this.uName + ": Bearer token format " + (token.indexOf(".") === -1 ? "opaque" : "jwt") + " length=" + token.length);

   if (mode === "bearer") {
      console.log(this.uName + ": Bearer auth " + (this.auth && this.auth.token && token === this.auth.token ? "ok" : "failed"));
      return _callback(!!(this.auth && this.auth.token && token === this.auth.token));
   }

   if (mode === "oauth") {
      if (this.auth && this.auth.validator && typeof this.auth.validator === "function") {
         console.log(this.uName + ": OAuth auth via validator");
         return _callback(!!this.auth.validator(token, _request));
      }

      console.log(this.uName + ": OAuth auth via JWKS");
      return this.validateOAuthToken(token, _callback);
   }

   console.log(this.uName + ": Unknown auth mode");
   return _callback(false);
};

McpService.prototype.sendUnauthorized = function(_request, _response) {
   var resourceMetadataUrl = this.getBaseUrl(_request) + "/.well-known/oauth-protected-resource";

   _response.set("WWW-Authenticate", "Bearer resource_metadata=\"" + resourceMetadataUrl + "\"");
   _response.status(401).json({
      error: "unauthorized"
   });
};

McpService.prototype.validateOAuthToken = function(_token, _callback) {

   var parsed = this.parseJwt(_token);

   if (!parsed) {
      console.log(this.uName + ": JWT parse failed");
      return _callback(false);
   }

   console.log(this.uName + ": JWT header alg=" + parsed.header.alg + " kid=" + parsed.header.kid);

   if (!this.validateJwtClaims(parsed.payload)) {
      console.log(this.uName + ": JWT claims invalid");
      return _callback(false);
   }

   this.getJwksKey(parsed.header.kid, (key) => {
      if (!key) {
         console.log(this.uName + ": JWKS key not found");
         return _callback(false);
      }

      var verified = this.verifyJwtSignature(_token, key, parsed.header.alg);
      console.log(this.uName + ": JWT signature " + (verified ? "ok" : "failed"));
      return _callback(verified);
   });
};

McpService.prototype.parseJwt = function(_token) {

   var token = _token ? _token.trim() : "";
   var parts = token.split(".");

   if (parts.length !== 3) {
      if (parts.length === 5) {
         console.log(this.uName + ": JWE access tokens are not supported (expected JWS with 3 parts)");
      }
      return null;
   }

   var header = this.decodeJwtPart(parts[0]);
   var payload = this.decodeJwtPart(parts[1]);

   if (!header || !payload) {
      return null;
   }

   return { header: header, payload: payload };
};

McpService.prototype.decodeJwtPart = function(_part) {

   try {
      var padded = _part.replace(/-/g, "+").replace(/_/g, "/");
      var padLength = padded.length % 4;
      if (padLength) {
         padded += "====".slice(padLength);
      }
      var buf = Buffer.from(padded, "base64");
      return JSON.parse(buf.toString("utf8"));
   }
   catch (_err) {
      return null;
   }
};

McpService.prototype.validateJwtClaims = function(_payload) {

   var issuer = this.auth && this.auth.issuer ? this.auth.issuer : null;
   var audience = this.auth && this.auth.audience ? this.auth.audience : null;
   var now = Math.floor(Date.now() / 1000);
   var skew = this.auth && this.auth.clockSkewSec ? this.auth.clockSkewSec : 60;

   if (issuer && _payload.iss !== issuer) {
      return false;
   }

   if (audience) {
      if (Array.isArray(_payload.aud)) {
         if (_payload.aud.indexOf(audience) === -1) {
            return false;
         }
      }
      else if (_payload.aud !== audience) {
         return false;
      }
   }

   if (_payload.nbf && (now + skew) < _payload.nbf) {
      return false;
   }

   if (_payload.exp && (now - skew) >= _payload.exp) {
      return false;
   }

   return true;
};

McpService.prototype.getJwksKey = function(_kid, _callback) {

   if (!_kid) {
      console.log(this.uName + ": JWT kid missing");
      return _callback(null);
   }

   var now = Math.floor(Date.now() / 1000);
   var cachedKey = this.jwks.keysByKid[_kid];

   if (cachedKey && now < this.jwks.expiresAt) {
      console.log(this.uName + ": JWKS cache hit for kid " + _kid);
      return _callback(cachedKey);
   }

   this.fetchJwks((keys) => {
      if (!keys || !keys.length) {
         return _callback(null);
      }

      var found = null;

      for (var i = 0; i < keys.length; ++i) {
         if (keys[i].kid === _kid) {
            found = keys[i];
            break;
         }
      }

      return _callback(found);
   });
};

McpService.prototype.fetchJwks = function(_callback) {
   var jwksUri = this.getJwksUri();

   if (!jwksUri) {
      console.log(this.uName + ": JWKS URI not configured");
      return _callback(null);
   }

   var parsed = url.parse(jwksUri);
   var client = parsed.protocol === "http:" ? http : https;

   console.log(this.uName + ": Fetching JWKS from " + jwksUri);
   var req = client.get(jwksUri, (res) => {
      var data = "";

      res.on("data", (chunk) => {
         data += chunk;
      });

      res.on("end", () => {
         try {
            var body = JSON.parse(data);
            var keys = body.keys || [];
            var now = Math.floor(Date.now() / 1000);
            this.jwks.keysByKid = {};

            for (var i = 0; i < keys.length; ++i) {
               if (keys[i].kid) {
                  this.jwks.keysByKid[keys[i].kid] = keys[i];
               }
            }

            this.jwks.expiresAt = now + this.jwksCacheTtl;
            console.log(this.uName + ": JWKS cached, keys=" + keys.length);
            return _callback(keys);
         }
         catch (_err) {
            console.log(this.uName + ": JWKS parse failed");
            return _callback(null);
         }
      });
   });

   req.on("error", () => {
      console.log(this.uName + ": JWKS fetch failed");
      _callback(null);
   });
};

McpService.prototype.getJwksUri = function() {

   if (this.auth && this.auth.jwksUri) {
      return this.auth.jwksUri;
   }

   if (this.auth && this.auth.issuer) {
      var issuer = this.auth.issuer;
      var sep = issuer.endsWith("/") ? "" : "/";
      return issuer + sep + ".well-known/jwks.json";
   }

   return null;
};

McpService.prototype.verifyJwtSignature = function(_token, _jwk, _alg) {

   if (_alg && _alg !== "RS256") {
      console.log(this.uName + ": Unsupported JWT alg " + _alg);
      return false;
   }

   try {
      var keyObject = crypto.createPublicKey({ key: _jwk, format: "jwk" });
      var verify = crypto.createVerify("RSA-SHA256");
      var parts = _token.split(".");

      if (parts.length !== 3) {
         return false;
      }

      verify.update(parts[0] + "." + parts[1]);
      verify.end();

      var signature = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
      return verify.verify(keyObject, signature);
   }
   catch (_err) {
      return false;
   }
};

McpService.prototype.getBaseUrl = function(_request) {
   var proto = _request.headers && _request.headers["x-forwarded-proto"]
      ? _request.headers["x-forwarded-proto"]
      : _request.protocol;
   var host = _request.headers && _request.headers["x-forwarded-host"]
      ? _request.headers["x-forwarded-host"]
      : _request.headers.host;
   return proto + "://" + host;
};

McpService.prototype.handleJsonRpc = function(_body, _request, _response) {

   if (!_body || !_body.method) {
      return this.sendJsonRpcError(_response, null, -32600, "Invalid Request");
   }

   if (_body instanceof Array) {
      return this.sendJsonRpcError(_response, null, -32600, "Batch requests are not supported");
   }

   var id = _body.hasOwnProperty("id") ? _body.id : null;
   var method = _body.method;
   var params = _body.params;

   if (method === "initialize") {
      var requestedVersion = params && params.protocolVersion ? params.protocolVersion : MCP_PROTOCOL_VERSION;
      var negotiatedVersion = this.supportedProtocolVersions.indexOf(requestedVersion) !== -1
         ? requestedVersion
         : MCP_PROTOCOL_VERSION;

      this.setProtocolHeader(_response, negotiatedVersion);

      return this.sendJsonRpcResult(_response, id, {
         protocolVersion: negotiatedVersion,
         capabilities: {
            tools: {
               listChanged: false
            }
         },
         serverInfo: {
            name: "casa-mcp",
            version: "0.1.0"
         }
      });
   }

   if (!this.hasProtocolHeader(_request)) {
      return this.sendJsonRpcError(_response, id, -32600, "Missing MCP-Protocol-Version header");
   }

   this.setProtocolHeader(_response, _request.headers["mcp-protocol-version"]);

   if (!id && method && method.startsWith("notifications/")) {
      _response.status(204).end();
      return null;
   }

   if (method === "ping") {
      return this.sendJsonRpcResult(_response, id, {});
   }

   if (method === "tools/list") {
      return this.sendJsonRpcResult(_response, id, {
         tools: [
            {
               name: "casa.get_named_object_tree",
               title: "Get Named Object Tree",
               description: "Return an exported named-object subtree",
               inputSchema: {
                  type: "object",
                  properties: {
                     uName: { type: "string" }
                  }
               },
               annotations: {
                  readOnlyHint: true
               }
            },
            {
               name: "casa.get_control_status",
               title: "Get Control Status",
               description: "Read current MODE, manual override countdown and expected return to auto. Times are estimates, not guarantees of hardware state.",
               inputSchema: {
                  type: "object",
                  properties: { uName: { type: "string" } },
                  required: [ "uName" ]
               },
               annotations: { readOnlyHint: true }
            },
            {
               name: "casa.set_mode_manual",
               title: "Set Manual Mode",
               description: "Enter manual mode and return control status. An existing manual override is unchanged; use renew to replace its remaining duration. Duration is positive seconds; omitted uses the configured default.",
               inputSchema: {
                  type: "object",
                  properties: {
                     uName: { type: "string" },
                     duration: { type: "number", exclusiveMinimum: 0 }
                  },
                  required: [ "uName" ]
               },
               annotations: {
                  readOnlyHint: false
               }
            },
            {
               name: "casa.release_manual_override",
               title: "Release Manual Override",
               description: "Release only manual mode and return observed control status. Other active modes are preserved.",
               inputSchema: { type: "object", properties: { uName: { type: "string" } }, required: [ "uName" ] },
               annotations: { readOnlyHint: false }
            },
            {
               name: "casa.renew_manual_override",
               title: "Renew Manual Override",
               description: "Replace the remaining time of an active manual override with duration seconds from now, including an unchanged duration. Return observed control status; peer timing may be unknown and completed false even when the owner renews successfully.",
               inputSchema: { type: "object", properties: {
                  uName: { type: "string" }, duration: { type: "number", exclusiveMinimum: 0 }
               }, required: [ "uName", "duration" ] },
               annotations: { readOnlyHint: false }
            },
            {
               name: "casa.set_property",
               title: "Set Property",
               description: "Set a property on its hosting Casa, including unmirrored compound members. Supply casa when the object is not visible here.",
               inputSchema: {
                  type: "object",
                  properties: {
                     uName: { type: "string" },
                     property: { type: "string" },
                     casa: { type: "string", description: "Hosting Casa name" },
                     value: {}
                  },
                  required: [ "uName", "property", "value" ]
               },
               annotations: {
                  readOnlyHint: false
               }
            }
         ].concat(this.getManagementTools(), this.getSceneTools(), this.getInspectionTools(), [{
            name: "casa.discover_objects", title: "Discover Objects Across Casas",
            description: "Query known Casas in parallel for compact local object inventories, including compound members. Results are grouped by host; unavailable Casas are reported. No mirrors or subscriptions are added.",
            inputSchema: { type: "object", properties: { timeoutSeconds: { type: "number", minimum: 1, maximum: 30, default: 5 } } },
            annotations: { readOnlyHint: true }
         }])
      });
   }

   if (method === "tools/call") {
      return this.handleToolCall(id, params, _response);
   }

   return this.sendJsonRpcError(_response, id, -32601, "Method not found");
};

McpService.prototype.handleToolCall = function(_id, _params, _response) {

   if (!_params || !_params.name) {
      return this.sendJsonRpcError(_response, _id, -32602, "Invalid params");
   }

   if (_params.name === "casa.discover_objects") {
      var timeout = (_params.arguments || {}).timeoutSeconds;
      if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 1 || timeout > 30)) {
         return this.sendJsonRpcError(_response, _id, -32602, "timeoutSeconds must be between 1 and 30");
      }
      return this.discoverObjects(timeout === undefined ? 5 : timeout, (result) => {
         this.sendJsonRpcResult(_response, _id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false });
      });
   }

   var inspectionCommands = { "casa.describe_thing": "describeThing", "casa.describe_source_state": "describeSourceState" };
   if (Object.prototype.hasOwnProperty.call(inspectionCommands, _params.name)) {
      var inspection = _params.arguments || {};
      if (typeof inspection.uName !== "string" || !inspection.uName.trim()) {
         return this.sendJsonRpcError(_response, _id, -32602, "uName is required");
      }
      return this.invokeConsoleCommand({ uName: inspection.uName, hostingCasa: inspection.casa }, inspectionCommands[_params.name], [], (error, result) => {
         if (error) return this.sendJsonRpcError(_response, _id, -32000, error.message || String(error));
         this.sendJsonRpcResult(_response, _id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false });
      });
   }

   var sceneCommands = { "casa.list_scenes": "listScenes", "casa.get_scene_status": "getSceneStatus",
      "casa.set_scene": "setScene", "casa.release_scene": "releaseScene" };
   if (Object.prototype.hasOwnProperty.call(sceneCommands, _params.name)) {
      var sceneArgs = _params.arguments || {};
      if (typeof sceneArgs.uName !== "string" || !sceneArgs.uName.trim() ||
          (_params.name === "casa.set_scene" && (typeof sceneArgs.scene !== "string" || !sceneArgs.scene.trim()))) {
         return this.sendJsonRpcError(_response, _id, -32602, "uName and a scene name for set_scene are required");
      }
      var building = sceneArgs.casa ? { uName: sceneArgs.uName, hostingCasa: sceneArgs.casa } : this.gang.findNamedObject(sceneArgs.uName);
      if (!building) return this.sendJsonRpcError(_response, _id, -32000, "Object not found");
      return this.invokeBuildingSceneCommand(building, sceneCommands[_params.name], _params.name === "casa.set_scene" ? [sceneArgs.scene] : [], (error, result) => {
         if (error) return this.sendJsonRpcError(_response, _id, -32000, error.message || String(error));
         this.sendJsonRpcResult(_response, _id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false });
      });
   }

   if (this.getManagementTools().some(function(tool) { return tool.name === _params.name; })) {
      return this.handleManagementTool(_id, _params, _response);
   }

   if (_params.name === "casa.get_control_status") {
      var statusArgs = _params.arguments || {};
      if (typeof statusArgs.uName !== "string" || !statusArgs.uName.trim()) {
         return this.sendJsonRpcError(_response, _id, -32602, "uName is required");
      }
      var statusTarget = this.gang.findNamedObject(statusArgs.uName);
      if (!statusTarget) {
         return this.sendJsonRpcError(_response, _id, -32000, "Object not found");
      }
      if (!statusTarget.properties || !statusTarget.properties.MODE) {
         return this.sendJsonRpcError(_response, _id, -32000, "Target does not expose MODE");
      }
      var status = this.getControlStatus(statusTarget);
      return this.sendJsonRpcResult(_response, _id, {
         content: [{ type: "text", text: JSON.stringify(status) }],
         structuredContent: status,
         isError: false
      });
   }

   if (_params.name === "casa.get_named_object_tree") {
      var uName = _params.arguments && _params.arguments.uName ? _params.arguments.uName : ":";
      var obj = this.gang.findNamedObject(uName);

      if (!obj) {
         return this.sendJsonRpcError(_response, _id, -32000, "Object not found");
      }

      var exportObj = {};
      this.exportNamedObject(obj, exportObj);

      return this.sendJsonRpcResult(_response, _id, {
         content: [ { type: "text", text: JSON.stringify(exportObj) } ],
         structuredContent: exportObj,
         isError: false
      });
   }

   if (["casa.set_mode_manual", "casa.release_manual_override", "casa.renew_manual_override"].indexOf(_params.name) !== -1) {
      return this.handleManualControl(_id, _params, _response);
   }

   if (_params.name === "casa.set_property") {
      var args2 = _params.arguments || {};
      if (typeof args2.uName !== "string" || !args2.uName.trim() || typeof args2.property !== "string" || !Object.prototype.hasOwnProperty.call(args2, "value")) {
         return this.sendJsonRpcError(_response, _id, -32602, "uName, property and value are required");
      }
      var target2 = { uName: args2.uName, hostingCasa: args2.casa };

      return this.invokeConsoleCommand(target2, "setProperty", [args2.property, args2.value, { sourceName: "mcp" }], (error, result) => {
         if (error || !result) {
            return this.sendJsonRpcError(_response, _id, -32000, error ? (error.message || String(error)) : "Property not found or rejected");
         }
         return this.sendJsonRpcResult(_response, _id, {
            content: [ { type: "text", text: "ok" } ],
            structuredContent: { ok: true }, isError: false
         });
      });
   }

   return this.sendJsonRpcError(_response, _id, -32601, "Unknown tool");
};

McpService.prototype.getSceneTools = function() {
   return [
      ["list_scenes", "List configured building scenes and current status", true],
      ["get_scene_status", "Observe selected building scene, expiry and room control; physical outputs are not confirmed", true],
      ["set_scene", "Select a named building scene through its button, leaving manual mode unchanged", false],
      ["release_scene", "Release building scene buttons, leaving manual mode unchanged", false]
   ].map(function(entry) {
      var schema = { type: "object", properties: { uName: { type: "string" }, casa: { type: "string", description: "Hosting Casa name" } }, required: ["uName"] };
      if (entry[0] === "set_scene") { schema.properties.scene = { type: "string" }; schema.required.push("scene"); }
      return { name: "casa." + entry[0], description: entry[1], inputSchema: schema, annotations: { readOnlyHint: entry[2] } };
   });
};

McpService.prototype.getManagementTools = function() {
   return [
      { name: "casa.export_config", title: "Export Stored Configuration",
        description: "Export the local Casa or gang database documents and revision hash. Stored configuration, not live state; may contain configured credentials.",
        inputSchema: { type: "object", properties: { scope: { enum: ["casa", "gang"] } }, required: ["scope"] },
        annotations: { readOnlyHint: true } },
      { name: "casa.preview_config", title: "Preview Configuration Changes",
        description: "Use the existing configuration preview engine to inspect proposed changes without saving. This is not full hardware or runtime validation.",
        inputSchema: { type: "object", properties: { options: { type: "object" } }, required: ["options"] },
        annotations: { readOnlyHint: true } },
      { name: "casa.deploy_config", title: "Save Configuration for Restart",
        description: "Replace one local configuration database using edited documents from export_config. Requires its current revision. Saves a backup; does not restart or hot-apply. Use this for modifying an existing setup or deploying a replacement configuration.",
        inputSchema: { type: "object", properties: { scope: { enum: ["casa", "gang"] },
           expectedRevision: { type: "string" }, docs: { type: "array", items: { type: "object" } }
        }, required: ["scope", "expectedRevision", "docs"] },
        annotations: { readOnlyHint: false, destructiveHint: true } },
      { name: "casa.restart", title: "Restart Casa Process",
        description: "Request restart of this endpoint's Casa process, not a Pi reboot. Requires its exact Casa name. A process supervisor must restart it; this response does not confirm recovery.",
        inputSchema: { type: "object", properties: { casaName: { type: "string" } }, required: ["casaName"] },
        annotations: { readOnlyHint: false, destructiveHint: true } }
   ];
};

McpService.prototype.handleManagementTool = function(_id, _params, _response) {
   var args = _params.arguments || {};
   var casa = this.gang.casa;
   var reply = (value) => this.sendJsonRpcResult(_response, _id, {
      content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false
   });
   var fail = (error) => this.sendJsonRpcError(_response, _id, -32000, error.message || String(error));
   if (_params.name === "casa.restart") {
      if (args.casaName !== casa.name) return fail("casaName must match this endpoint's Casa");
      if (this.gang.ignoreRestart) return fail("Restart is disabled by ignoreRestart");
      if (this.configWriteInProgress) return fail("Configuration write in progress");
      if (this.restartPending) return fail("Restart already requested");
      try { this.getConsoleApi(casa); } catch (error) { return fail(error); }
      this.restartPending = true;
      // Wait until the response is handed off before invoking the existing restart path.
      _response.once("finish", () => setTimeout(() => this.restartCasaProcess(), 100));
      return reply({ accepted: true, casaName: casa.name, action: "restart_process", recoveryConfirmed: false });
   }
   if (_params.name === "casa.preview_config") {
      if (!args.options || typeof args.options !== "object" || Array.isArray(args.options)) return fail("options must be an object");
      return this.invokeConsoleCommand(casa, "previewConfig", [args.options], (error, result) => error ? fail(error) : reply(result));
   }
   if (args.scope !== "casa" && args.scope !== "gang") return fail("scope must be casa or gang");
   var dbName = (args.scope === "casa" ? casa.name : this.gang.name) + "-db";
   var db = this.gang.getDb(dbName);
   if (!db) return fail("Configuration database is unavailable");
   if (this.configWriteInProgress || this.restartPending) return fail("Configuration write or restart in progress");
   var deploy = _params.name === "casa.deploy_config";
   if (deploy) {
      if (typeof args.expectedRevision !== "string" || !args.expectedRevision || !Array.isArray(args.docs) || !args.docs.length) {
         return fail("expectedRevision and a nonempty docs array are required");
      }
      var ids = new Set();
      for (var doc of args.docs) {
         if (!doc || typeof doc !== "object" || typeof doc._id !== "string" || !doc._id ||
             typeof doc._collection !== "string" || !doc._collection || ids.has(doc._id)) {
            return fail("Each document requires a unique _id and _collection");
         }
         ids.add(doc._id);
      }
      var identity = args.scope === "casa" ? casa.name : this.gang.name;
      if (!args.docs.some(function(doc) { return doc._collection === args.scope && doc.name === identity; })) {
         return fail("Replacement must retain the target's identity document");
      }
      this.configWriteInProgress = true;
   }
   this.invokeConsoleCommand(args.scope === "casa" ? casa : this.gang, "exportDb", [], (error, docs) => {
      if (error) { this.configWriteInProgress = false; return fail(error); }
      var revision = this.configurationRevision(docs);
      if (!deploy) return reply({ casaName: casa.name, scope: args.scope, dbName: dbName, revision: revision, docs: docs });
      if (revision !== args.expectedRevision) {
         this.configWriteInProgress = false;
         return fail("Configuration changed; export it again before deploying");
      }
      var fs = require("fs");
      var path = require("path");
      var backup = path.join(this.gang.configPath(), dbName + ".mcp-backup-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ".json");
      fs.writeFile(backup, JSON.stringify({ dbName: dbName, revision: revision, docs: docs }, null, 2), { flag: "wx", mode: 0o600 }, (backupError) => {
         if (backupError) { this.configWriteInProgress = false; return fail(backupError); }
         this.invokeConsoleCommand(casa, "replaceDb", [{ dbName: dbName, docs: args.docs }], (writeError) => {
            if (writeError) {
               return this.invokeConsoleCommand(casa, "replaceDb", [{ dbName: dbName, docs: docs }], (restoreError) => {
                  this.configWriteInProgress = false;
                  return fail("Deployment failed; backup: " + backup + "; rollback " + (restoreError ? "failed: " + String(restoreError) : "completed") + "; " + String(writeError));
               });
            }
            this.invokeConsoleCommand(args.scope === "casa" ? casa : this.gang, "exportDb", [], (readError, savedDocs) => {
               this.configWriteInProgress = false;
               if (readError) return fail("Configuration saved but readback failed; backup: " + backup + "; " + String(readError));
               var savedRevision = this.configurationRevision(savedDocs);
               if (savedRevision !== this.configurationRevision(args.docs)) {
                  return fail("Configuration readback differs from requested documents; export before retrying; backup: " + backup);
               }
               return reply({ ok: true, casaName: casa.name, dbName: dbName,
                  revision: savedRevision, backup: backup, restartRequired: true, appliedToRuntime: false });
            });
         });
      });
   });
};

McpService.prototype.configurationRevision = function(_docs) {
   // NeDB read order is not a revision; hash a stable ordering of stored documents.
   var ordered = _docs.slice().sort(function(a, b) { return String(a._id).localeCompare(String(b._id)); });
   return crypto.createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
};

McpService.prototype.restartCasaProcess = function() {
   this.invokeConsoleCommand(this.gang.casa, "restart", [], (error) => {
      this.restartPending = false;
      if (error) console.error(error);
   });
};

McpService.prototype.getConsoleApi = function(_target) {
   var consoleService = this.gang.casa.findService("consoleapiservice");
   if (!consoleService) throw new Error("Console API service is unavailable");
   var api = consoleService.findOrCreateConsoleApiObject(_target);
   if (!api) throw new Error("Console API object is unavailable");
   return api;
};

// The tool selects the building interface; property access handles its placement.
McpService.prototype.invokeBuildingSceneCommand = function(_target, _command, _params, _callback) {
   try {
      if (_target.hostingCasa) {
         return this.invokeConsoleCommand(_target, _command, _params, _callback);
      }
   }
   catch (error) { return _callback(error); }
   var api = Object.create(BuildingConsoleApi.prototype);
   api.gang = this.gang;
   api.uName = _target.uName;
   try { return api[_command]({ name: "mcp" }, _params, _callback); }
   catch (error) { return _callback(error); }
};

McpService.prototype.discoverObjects = function(_timeoutSeconds, _callback) {
   var hosts = [this.gang.casa].concat(Object.keys(this.gang.peercasas || {}).map((name) => this.gang.peercasas[name]));
   var remaining = hosts.length;
   var results = new Array(remaining);
   var finish = (index, error, inventory) => {
      if (results[index]) return;
      results[index] = error
         ? { casa: hosts[index].name, error: error.message || String(error) }
         : inventory;
      if (--remaining === 0) {
         clearTimeout(timer);
         results.sort(function(a, b) { return a.casa.localeCompare(b.casa); });
         _callback({ complete: results.every(function(result) { return !result.error; }), casas: results });
      }
   };
   var timer = setTimeout(() => {
      hosts.forEach(function(host, index) { finish(index, "Discovery timed out"); });
   }, _timeoutSeconds * 1000);
   hosts.forEach((host, index) => {
      this.invokeConsoleCommand({ uName: host.uName, hostingCasa: host.name }, "discoverObjects", [], (error, inventory) => {
         finish(index, error, inventory);
      });
   });
};

McpService.prototype.getInspectionTools = function() {
   return [
      { name: "casa.describe_thing", title: "Describe Thing", description: "Inspect a Thing and discover its compound children on the hosting Casa, including local-only members." },
      { name: "casa.describe_source_state", title: "Describe Source State", description: "Read current properties and validity directly from the hosting Casa." }
   ].map(function(tool) {
      tool.inputSchema = { type: "object", properties: {
         uName: { type: "string" }, casa: { type: "string", description: "Hosting Casa name; required when no visible ancestor identifies the host" }
      }, required: ["uName"] };
      tool.annotations = { readOnlyHint: true };
      return tool;
   });
};

McpService.prototype.getConsoleHost = function(_target) {
   if (_target.hostingCasa) {
      var name = _target.hostingCasa.replace(/^:/, "");
      if (name === this.gang.casa.name) return this.gang.casa;
      var peer = this.gang.findPeerCasa(name);
      if (!peer) throw new Error("Hosting Casa not found: " + name);
      return peer;
   }
   var object = _target;
   var address = _target.uName;
   while (address) {
      object = this.gang.findNamedObject ? this.gang.findNamedObject(address) : object;
      if (object && object.casa) return object.casa;
      address = address.slice(0, address.lastIndexOf(":"));
   }
   return this.gang.casa;
};

McpService.prototype.invokeConsoleCommand = function(_target, _command, _params, _callback) {
   try {
      var host = this.getConsoleHost(_target);
      if (host !== this.gang.casa) {
         return host.sendConsoleCommand({ obj: _target.uName, method: _command, arguments: _params }, _callback);
      }
      var target = this.gang.findNamedObject ? this.gang.findNamedObject(_target.uName) : _target;
      if (!target) return _callback("Object not found");
      var api = this.getConsoleApi(target);
      if (typeof api[_command] !== "function") return _callback("Command is not supported by this object");
      return api[_command]({ name: "mcp" }, _params, _callback);
   }
   catch (error) { return _callback(error); }
};

McpService.prototype.handleManualControl = function(_id, _params, _response) {
   var args = _params.arguments || {};
   var renew = _params.name === "casa.renew_manual_override";
   var release = _params.name === "casa.release_manual_override";
   if (typeof args.uName !== "string" || !args.uName.trim() ||
       ((renew || args.hasOwnProperty("duration")) && (!Number.isFinite(args.duration) || args.duration <= 0))) {
      return this.sendJsonRpcError(_response, _id, -32602, "uName and, when supplied, a positive finite duration in seconds are required");
   }
   var target = this.gang.findNamedObject(args.uName);
   var mode = target && target.properties && target.properties.MODE;
   if (!mode || !mode.valid || mode.cold || !target.properties["MANUAL-MODE-DURATION"] || !target.properties["MANUAL-MODE-ACTIVE"]) {
      return this.sendJsonRpcError(_response, _id, -32000, "Target requires valid MODE and manual duration/active properties");
   }
   var previousEnd = renew ? this.getControlStatus(target).manualOverride.endsAt : null;
   var requestedAt = Date.now();
   // Property events and the MODE settling state are asynchronous. Observe for a bounded period.
   var respond = () => {
      var status = this.getControlStatus(target);
      var completed = status.modeValid && (release
         ? (target.getProperty("MANUAL-MODE-ACTIVE") === false && ["manual", "invalid", "settle-invalid"].indexOf(status.mode) === -1)
         : status.mode === "manual");
      if (renew) {
         completed = completed && status.manualOverride.status === "timed" &&
            Date.parse(status.manualOverride.endsAt) >= requestedAt + args.duration * 1000 - 100 &&
            status.manualOverride.endsAt !== previousEnd;
      }
      if (!completed && Date.now() - requestedAt < 1000) {
         setTimeout(respond, 20);
         return;
      }
      var result = { ok: true, completed: completed, controlStatus: status };
      this.sendJsonRpcResult(_response, _id, {
         content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: false
      });
   };
   var command = renew ? "renewManualOverride" : release ? "releaseManualOverride" : "setManualMode";
   this.invokeConsoleCommand(target, command, release ? [] : [args.duration], (error) => {
      if (error) return this.sendJsonRpcError(_response, _id, -32000, error.message || String(error));
      respond();
   });
};

McpService.prototype.getControlStatus = function(_target) {
   var mode = _target.properties.MODE;
   var now = Date.now();
   var valid = mode.valid === true && !mode.cold;
   var local = !_target.fromPeer && !_target.bowing;
   var result = {
      uName: _target.uName,
      displayName: _target.displayName || _target.name,
      observedAt: new Date(now).toISOString(),
      mode: _target.getProperty("MODE") === undefined ? null : _target.getProperty("MODE"),
      modeValid: valid,
      timingAuthority: local ? "local" : "peer",
      controller: _target.controller ? {
         uName: _target.controller.uName,
         state: _target.controller.currentState ? _target.controller.currentState.name : null
      } : null,
      manualOverride: { status: "unknown", remainingSeconds: null, endsAt: null },
      returnToAuto: { status: "unknown", expectedAt: null }
   };

   if (!valid) return result;
   if (result.mode !== "manual") {
      result.manualOverride.status = "inactive";
      if (result.mode === "auto") result.returnToAuto.status = "already_auto";
      return result;
   }

   var expiry = _target.properties["MODE-EXPIRES-AT"];
   if (!expiry || !expiry.valid || expiry.cold) return result;
   var expiresAt = _target.getProperty("MODE-EXPIRES-AT");
   if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= 8640000000000000) {
      result.manualOverride.status = "timed";
      result.manualOverride.remainingSeconds = Math.ceil(Math.max(0, expiresAt - now) / 1000);
      result.manualOverride.endsAt = new Date(expiresAt).toISOString();
      var resting = _target.properties["MODE-RESTING-STATE"];
      if (resting && resting.valid && !resting.cold && _target.getProperty("MODE-RESTING-STATE") === "auto") {
         result.returnToAuto = {
            status: "expected", expectedAt: result.manualOverride.endsAt,
            condition: "After manual mode expires and settles, provided no other mode or override intervenes."
         };
      }
   }
   else if (expiresAt === -1) {
      var duration = _target.properties["MANUAL-MODE-DURATION"];
      if (duration && duration.valid && !duration.cold && _target.getProperty("MANUAL-MODE-DURATION") === -1) {
         result.manualOverride.status = "indefinite";
         result.returnToAuto.status = "not_scheduled";
      }
   }

   return result;
};

McpService.prototype.sendJsonRpcResult = function(_response, _id, _result) {

   _response.status(200).json({
      jsonrpc: "2.0",
      id: _id,
      result: _result
   });
};

McpService.prototype.sendJsonRpcError = function(_response, _id, _code, _message) {

   _response.status(200).json({
      jsonrpc: "2.0",
      id: _id,
      error: {
         code: _code,
         message: _message
      }
   });
};

McpService.prototype.hasProtocolHeader = function(_request) {
   var header = _request && _request.headers ? _request.headers["mcp-protocol-version"] : null;
   return !!header;
};

McpService.prototype.setProtocolHeader = function(_response, _version) {

   if (_version) {
      _response.set("MCP-Protocol-Version", _version);
   }
};

McpService.prototype.defaultExportFilter = function(_child, _owner) {

   if (!_child) {
      return false;
   }

   if (_child.superType && (_child.superType() === "sourcelistener")) {
      return false;
   }

   if (_child.fromPeer || _child.local) {
      return false;
   }

   return true;
};

McpService.prototype.getExportFilter = function() {

   if (this.gang && this.gang.casa && (typeof this.gang.casa.shouldExportChildInSharedConfig === "function")) {
      return this.gang.casa.shouldExportChildInSharedConfig.bind(this.gang.casa);
   }

   return McpService.prototype.defaultExportFilter.bind(this);
};

McpService.prototype.exportNamedObject = function(_obj, _exportObj) {
   var filterCb = this.getExportFilter();

   if (_obj && (typeof _obj.exportFiltered === "function")) {
      _obj.exportTree(_exportObj, filterCb);
   }
   else if (_obj && (typeof _obj.export === "function")) {
      _obj.exportTree(_exportObj);
   }
};

module.exports = exports = McpService;
