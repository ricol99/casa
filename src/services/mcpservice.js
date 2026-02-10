var util = require('util');
var WebService = require('./webservice');

function McpService(_config, _owner) {
   _config.socketIoSupported = false;
   WebService.call(this, _config, _owner);

   this.mcpRoute = _config.hasOwnProperty("mcpRoute") ? _config.mcpRoute : "/mcp";
   this.maxBodyBytes = _config.hasOwnProperty("maxBodyBytes") ? _config.maxBodyBytes : 1024 * 1024;
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

   this.addRoute(this.mcpRoute, McpService.prototype.handleGet.bind(this));
   this.addPostRoute(this.mcpRoute, McpService.prototype.handlePost.bind(this));
};

McpService.prototype.handleGet = function(_request, _response) {

   _response.status(200).json({
      name: "casa-mcp",
      status: "ok"
   });
};

McpService.prototype.handlePost = function(_request, _response) {

   this.collectJsonBody(_request, (_err, _body) => {
      if (_err) {
         return this.sendJsonRpcError(_response, null, -32700, "Invalid JSON");
      }

      return this.handleJsonRpc(_body, _response);
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

McpService.prototype.handleJsonRpc = function(_body, _response) {

   if (!_body || !_body.method) {
      return this.sendJsonRpcError(_response, null, -32600, "Invalid Request");
   }

   var id = _body.hasOwnProperty("id") ? _body.id : null;
   var method = _body.method;
   var params = _body.params;

   // TODO: Align method names and response format with the MCP specification.
   if (method === "initialize") {
      return this.sendJsonRpcResult(_response, id, {
         name: "casa-mcp",
         version: "0.1.0",
         capabilities: {
            tools: true,
            resources: false
         }
      });
   }

   if (method === "tools/list") {
      return this.sendJsonRpcResult(_response, id, {
         tools: [
            {
               name: "casa.get_named_object_tree",
               description: "Return an exported named-object subtree",
               inputSchema: {
                  type: "object",
                  properties: {
                     uName: { type: "string" }
                  }
               }
            },
            {
               name: "casa.set_mode_manual",
               description: "Set MODE to manual for a named object",
               inputSchema: {
                  type: "object",
                  properties: {
                     uName: { type: "string" },
                     duration: { type: "number" }
                  },
                  required: [ "uName" ]
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

      return this.sendJsonRpcResult(_response, _id, { content: exportObj });
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

      return this.sendJsonRpcResult(_response, _id, { ok: true });
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

module.exports = exports = McpService;
