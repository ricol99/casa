var util = require('util');
var WebService = require('./webservice');
var crypto = require('crypto');
var https = require('https');
var http = require('http');
var url = require('url');

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
               name: "casa.set_mode_manual",
               title: "Set Manual Mode",
               description: "Set MODE to manual for a named object",
               inputSchema: {
                  type: "object",
                  properties: {
                     uName: { type: "string" },
                     duration: { type: "number" }
                  },
                  required: [ "uName" ]
               },
               annotations: {
                  readOnlyHint: false
               }
            }
         ]
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

   if (_params.name === "casa.get_named_object_tree") {
      var uName = _params.arguments && _params.arguments.uName ? _params.arguments.uName : "::";
      var obj = this.gang.findNamedObject(uName);

      if (!obj) {
         return this.sendJsonRpcError(_response, _id, -32000, "Object not found");
      }

      var exportObj = {};
      obj.export(exportObj);

      return this.sendJsonRpcResult(_response, _id, {
         content: [ { type: "text", text: JSON.stringify(exportObj) } ],
         structuredContent: exportObj,
         isError: false
      });
   }

   if (_params.name === "casa.set_mode_manual") {
      var args = _params.arguments || {};
      var target = args.uName ? this.gang.findNamedObject(args.uName) : null;

      if (!target || !target.setManualMode) {
         return this.sendJsonRpcError(_response, _id, -32000, "Target does not support manual mode");
      }

      if (args.hasOwnProperty("duration")) {
         target.setManualMode(args.duration);
      }
      else {
         target.setManualMode();
      }

      return this.sendJsonRpcResult(_response, _id, {
         content: [ { type: "text", text: "ok" } ],
         structuredContent: { ok: true },
         isError: false
      });
   }

   return this.sendJsonRpcError(_response, _id, -32601, "Unknown tool");
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

module.exports = exports = McpService;
