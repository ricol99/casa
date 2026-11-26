var util = require('util');
var fs = require('fs');
var os = require('os');
var path = require('path');
var Service = require('../service');

function CloudflareTunnelService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.enabled = _config.enabled !== false;
   this.binaryPath = _config.binaryPath;
   this.token = _config.token;
   this.credentials = _config.credentials;
   this.ingress = _config.ingress;
   this.generatedConfigDirectory = null;
   this.restartDelay = _config.hasOwnProperty('restartDelay') ? _config.restartDelay : 10000;
   this.stopTimeout = _config.hasOwnProperty('stopTimeout') ? _config.stopTimeout : 5000;
   this.tunnel = null;
   this.restartTimer = null;
   this.stopTimer = null;
   this.stopping = false;
   this.connections = {};
   this.status = 'stopped';
   this.lastError = null;
   this.exitHandler = this.processExiting.bind(this);
}

util.inherits(CloudflareTunnelService, Service);

CloudflareTunnelService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
   this.start();
};

CloudflareTunnelService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
   this.start();
};

CloudflareTunnelService.prototype.validateConfig = function() {
   if (typeof this.binaryPath !== 'string' || !this.binaryPath ||
       !Number.isFinite(this.restartDelay) || this.restartDelay < 1000 ||
       !Number.isFinite(this.stopTimeout) || this.stopTimeout < 1) {
      throw new Error('Invalid tunnel executable or timer configuration');
   }

   if (this.credentials !== undefined) {
      if (this.token !== undefined || !this.credentials ||
          typeof this.credentials.AccountTag !== 'string' || !this.credentials.AccountTag ||
          typeof this.credentials.TunnelSecret !== 'string' || !this.credentials.TunnelSecret ||
          typeof this.credentials.TunnelID !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.credentials.TunnelID) ||
          !Array.isArray(this.ingress) || !this.ingress.length) {
         throw new Error('Local tunnel credentials and ingress rules are required');
      }
      for (var index = 0; index < this.ingress.length; ++index) {
         var rule = this.ingress[index];
         if (!rule || typeof rule.service !== 'string' || !rule.service) {
            throw new Error('Each ingress rule requires a service');
         }
      }
      var lastRule = this.ingress[this.ingress.length - 1];
      if (lastRule.hostname || lastRule.path) throw new Error('The final ingress rule must be a catch-all');
   }
   else if (typeof this.token !== 'string' || !this.token.trim() ||
            this.token.indexOf('\0') !== -1 || this.ingress !== undefined) {
      throw new Error('A remote tunnel token is required; ingress is managed in Cloudflare');
   }
   fs.accessSync(this.binaryPath, fs.constants.X_OK);
};

CloudflareTunnelService.prototype.createTunnel = function() {
   var cloudflared = require('cloudflared');
   var args = ['tunnel', '--no-autoupdate', 'run', '--token', this.token];
   if (this.credentials) {
      // JSON is valid YAML. Keep the connector's required file internal to the service.
      this.generatedConfigDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'casa-cloudflare-'));
      fs.chmodSync(this.generatedConfigDirectory, 0o700);
      var configPath = path.join(this.generatedConfigDirectory, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify({
         tunnel: this.credentials.TunnelID,
         'credentials-contents': JSON.stringify(this.credentials),
         ingress: this.ingress
      }), { mode: 0o600 });
      args = ['tunnel', '--no-autoupdate', '--config', configPath, 'run', this.credentials.TunnelID];
   }

   // The wrapper selects its executable globally, but spawns synchronously.
   // Restore it immediately so another service does not inherit our path.
   var previousBinary = cloudflared.bin;
   try {
      cloudflared.use(this.binaryPath);
      var tunnel = new cloudflared.Tunnel(args);
      // The wrapper enables raw logging when VERBOSE is inherited from the environment.
      // Keep connector output private even in that case.
      if (tunnel.process.stdout) {
         tunnel.process.stdout.unpipe(process.stdout);
         tunnel.process.stdout.resume();
      }
      if (tunnel.process.stderr) {
         tunnel.process.stderr.unpipe(process.stderr);
         tunnel.process.stderr.resume();
      }
      return tunnel;
   }
   finally {
      cloudflared.use(previousBinary);
   }
};

CloudflareTunnelService.prototype.start = function() {
   if (!this.enabled || this.tunnel || this.restartTimer || this.stopTimer) return false;
   this.stopping = false;
   this.lastError = null;
   this.connections = {};
   try {
      this.validateConfig();
      this.tunnel = this.createTunnel();
      process.once('exit', this.exitHandler);
      this.status = 'connecting';
      this.tunnel.on('connected', this.connected.bind(this, this.tunnel));
      this.tunnel.on('disconnected', this.disconnected.bind(this, this.tunnel));
      this.tunnel.on('error', this.failed.bind(this, this.tunnel));
      // A failed spawn emits close without exit; close also waits for streams.
      this.tunnel.process.once('close', this.closed.bind(this, this.tunnel));
      return true;
   }
   catch (_error) {
      this.removeGeneratedConfig();
      // Do not log raw errors, arguments or connector output: they can contain credentials.
      this.lastError = 'Unable to start tunnel; check wrapper, executable and tunnel parameters';
      this.status = 'error';
      console.error(this.uName + ': ' + this.lastError);
      this.scheduleRestart();
      return false;
   }
};

CloudflareTunnelService.prototype.connected = function(_tunnel, _connection) {
   if (_tunnel !== this.tunnel || this.stopping) return;
   this.connections[_connection.id] = true;
   this.status = 'connected';
   this.lastError = null;
};

CloudflareTunnelService.prototype.disconnected = function(_tunnel, _connection) {
   if (_tunnel !== this.tunnel || this.stopping) return;
   delete this.connections[_connection.id];
   if (!Object.keys(this.connections).length) this.status = 'connecting';
};

CloudflareTunnelService.prototype.failed = function(_tunnel, _error) {
   if (_tunnel !== this.tunnel || this.stopping) return;
   this.lastError = 'Tunnel process reported an error';
   this.status = 'error';
   console.error(this.uName + ': ' + this.lastError);
};

CloudflareTunnelService.prototype.closed = function(_tunnel, _code, _signal) {
   if (_tunnel !== this.tunnel) return;
   clearTimeout(this.stopTimer);
   this.stopTimer = null;
   this.tunnel = null;
   this.removeGeneratedConfig();
   process.removeListener('exit', this.exitHandler);
   this.connections = {};
   this.status = 'stopped';
   if (!this.stopping) {
      this.lastError = 'Tunnel process exited';
      this.scheduleRestart();
   }
};

CloudflareTunnelService.prototype.scheduleRestart = function() {
   if (!this.enabled || this.stopping || this.restartTimer) return;
   // Invalid timer settings must not cause a tight restart loop.
   if (!Number.isFinite(this.restartDelay) || this.restartDelay < 1000) return;
   this.status = 'retrying';
   this.restartTimer = setTimeout(this.restart.bind(this), this.restartDelay);
   this.restartTimer.unref();
};

CloudflareTunnelService.prototype.restart = function() {
   this.restartTimer = null;
   if (!this.stopping) this.start();
};

CloudflareTunnelService.prototype.stop = function() {
   this.stopping = true;
   clearTimeout(this.restartTimer);
   this.restartTimer = null;
   if (!this.tunnel) {
      this.status = 'stopped';
      return;
   }
   if (this.stopTimer) return;
   this.status = 'stopping';
   this.stopTimer = setTimeout(this.forceStop.bind(this, this.tunnel), this.stopTimeout);
   this.tunnel.stop();
};

CloudflareTunnelService.prototype.forceStop = function(_tunnel) {
   if (_tunnel === this.tunnel) _tunnel.process.kill('SIGKILL');
};

CloudflareTunnelService.prototype.goingDown = function(_error) {
   this.stop();
};

// Casa also has immediate process.exit paths, where asynchronous cleanup cannot run.
CloudflareTunnelService.prototype.processExiting = function() {
   if (this.tunnel) this.tunnel.process.kill('SIGKILL');
   this.removeGeneratedConfig();
};

CloudflareTunnelService.prototype.removeGeneratedConfig = function() {
   if (!this.generatedConfigDirectory) return;
   try {
      fs.rmSync(this.generatedConfigDirectory, { recursive: true, force: true });
      this.generatedConfigDirectory = null;
   }
   catch (_error) {
      console.error(this.uName + ': Unable to remove private tunnel configuration');
   }
};

CloudflareTunnelService.prototype.getStatus = function() {
   return {
      enabled: this.enabled,
      status: this.status,
      connections: Object.keys(this.connections).length,
      lastError: this.lastError
   };
};

module.exports = exports = CloudflareTunnelService;
