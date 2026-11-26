var assert = require('assert');
var EventEmitter = require('events');
var fs = require('fs');
var vm = require('vm');
var timers = [];
var tunnels = [];
var output = [];
var lastArgs;
var wrapper = {
   bin: '/original',
   use: function(binary) { this.bin = binary; },
   Tunnel: function(args) {
      lastArgs = args;
      assert.strictEqual(wrapper.bin, '/existing/cloudflared');
      var tunnel = new EventEmitter();
      tunnel.process = new EventEmitter();
      tunnel.process.kill = function(signal) { tunnel.signal = signal; };
      tunnel.stop = function() { tunnel.signal = 'SIGINT'; };
      tunnels.push(tunnel);
      return tunnel;
   }
};
function Base(config) { this.uName = ':test'; }
Base.prototype.coldStart = function() {};
Base.prototype.hotStart = function() {};
var sandbox = {
   process: new EventEmitter(),
   module: { exports: {} },
   require: function(name) {
      if (name === 'util' || name === 'os' || name === 'path') return require(name);
      if (name === 'fs') return { constants: fs.constants, accessSync: function() {} };
      if (name === '../service') return Base;
      if (name === 'cloudflared') return wrapper;
      throw new Error(name);
   },
   console: { error: function(message) { output.push(message); } },
   setTimeout: function(callback, delay) {
      var timer = { callback: callback, delay: delay, unref: function() {} };
      timers.push(timer);
      return timer;
   },
   clearTimeout: function(timer) { if (timer) timer.cancelled = true; }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../services/cloudflaretunnelservice'), 'utf8'), sandbox);
var Service = sandbox.module.exports;
var config = { binaryPath: '/existing/cloudflared', token: 'test-only-token' };
var service = new Service(config);
service.coldStart();
assert.strictEqual(service.status, 'connecting');
assert.strictEqual(wrapper.bin, '/original');
assert.strictEqual(JSON.stringify(lastArgs), JSON.stringify(['tunnel', '--no-autoupdate', 'run', '--token', 'test-only-token']));
service.hotStart();
assert.strictEqual(tunnels.length, 1, 'hot start must not duplicate a running connector');
var first = tunnels[0];
first.emit('connected', { id: 'a' });
first.emit('connected', { id: 'b' });
first.emit('disconnected', { id: 'a' });
assert.strictEqual(service.status, 'connected');
assert.strictEqual(service.getStatus().connections, 1);
first.emit('disconnected', { id: 'b' });
assert.strictEqual(service.status, 'connecting');
first.emit('error', new Error('secret token must not be logged'));
first.process.emit('close', -2, null);
assert.strictEqual(service.status, 'retrying');
assert.strictEqual(timers.length, 1);
assert.strictEqual(timers[0].delay, 10000);
timers[0].callback();
assert.strictEqual(tunnels.length, 2);
first.emit('connected', { id: 'stale' });
assert.strictEqual(service.getStatus().connections, 0);
service.goingDown();
assert.strictEqual(tunnels[1].signal, 'SIGINT');
assert.strictEqual(service.start(), false, 'cannot overlap a stopping process');
timers[1].callback();
assert.strictEqual(tunnels[1].signal, 'SIGKILL');
tunnels[1].process.emit('close', null, 'SIGKILL');
assert.strictEqual(service.status, 'stopped');
assert.strictEqual(service.restartTimer, null);
assert.ok(timers[1].cancelled);
assert.ok(!JSON.stringify(output).includes('secret token'));
assert.ok(!JSON.stringify(service.getStatus()).includes('test-only-token'));

var disabled = new Service({ enabled: false });
assert.strictEqual(disabled.start(), false);
var invalid = new Service({ binaryPath: '/existing/cloudflared', restartDelay: 0 });
assert.strictEqual(invalid.start(), false);
assert.strictEqual(invalid.restartTimer, null);
[undefined, '', '   ', 42, 'bad\0token'].forEach(function(token) {
   var invalidToken = new Service({ binaryPath: '/existing/cloudflared', token: token });
   assert.strictEqual(invalidToken.start(), false);
   invalidToken.stop();
   assert.strictEqual(invalidToken.restartTimer, null);
});

var originalTunnel = wrapper.Tunnel;
wrapper.Tunnel = function() { throw new Error('private credentials'); };
var failed = new Service(config);
assert.strictEqual(failed.start(), false);
assert.strictEqual(wrapper.bin, '/original', 'restore wrapper path after constructor failure');
failed.stop();
wrapper.Tunnel = originalTunnel;
var exiting = new Service(config);
exiting.start();
sandbox.process.emit('exit');
assert.strictEqual(exiting.tunnel.signal, 'SIGKILL');
exiting.stop();
exiting.tunnel.process.emit('close', null, 'SIGKILL');
assert.strictEqual(sandbox.process.listenerCount('exit'), 0);
assert.deepStrictEqual(config, { binaryPath: '/existing/cloudflared', token: 'test-only-token' });
assert.ok(Object.keys(Service.prototype).every(function(name) { return typeof Service.prototype[name] === 'function'; }));
console.log('[PASS] Cloudflare service lifecycle, credentials, reconnects, shutdown and configuration');
