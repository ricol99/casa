var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var vm = require('vm');
var wrapper = require(process.env.CASA_CLOUDFLARED_TEST_PACKAGE || 'cloudflared');
var directory = fs.mkdtempSync(path.join(os.tmpdir(), 'casa-tunnel-test-'));
var binary = path.join(directory, 'connector');
fs.writeFileSync(binary, '#!' + process.execPath + '\n' +
   'if (!process.argv.includes("--config") && process.argv.slice(2).join("|") !== "tunnel|--no-autoupdate|run|--token|test-only-token") process.exit(2);\n' +
   'process.on("SIGINT", function() { process.exit(0); });\n' +
   'console.error("Registered tunnel connection connIndex=0 connection=12345678-1234-4123-8123-123456789abc ip=192.0.2.1 location=test");\n' +
   'setInterval(function() {}, 1000);\n');
fs.chmodSync(binary, 0o755);
function Base() { this.uName = ':process-test'; }
Base.prototype.coldStart = function() {};
Base.prototype.hotStart = function() {};
var sandbox = {
   module: { exports: {} }, process: process, console: console,
   setTimeout: setTimeout, clearTimeout: clearTimeout,
   require: function(name) {
      if (name === '../service') return Base;
      if (name === 'cloudflared') return wrapper;
      return require(name);
   }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../services/cloudflaretunnelservice'), 'utf8'), sandbox);
var Service = sandbox.module.exports;

async function run() {
   var service = new Service({ binaryPath: binary, token: 'test-only-token' });
   var watchdog = setTimeout(function() { service.processExiting(); throw new Error('Connector test timed out'); }, 5000);
   try {
      assert.strictEqual(service.start(), true);
      await new Promise(function(resolve) { service.tunnel.once('connected', resolve); });
      assert.strictEqual(service.getStatus().status, 'connected');
      assert.strictEqual(service.getStatus().connections, 1);
      var closed = new Promise(function(resolve) { service.tunnel.process.once('close', resolve); });
      service.goingDown();
      await closed;
      assert.strictEqual(service.status, 'stopped');
      assert.strictEqual(service.restartTimer, null);
      assert.strictEqual(service.stopTimer, null);

      service.token = undefined;
      service.credentials = { AccountTag: 'test-account', TunnelSecret: 'test-secret', TunnelID: '12345678-1234-4123-8123-123456789abc' };
      service.ingress = [{ hostname: '*.example.test', service: 'http://192.0.2.1:8047', originRequest: { originServerName: 'example.test' } }, { service: 'http_status:404' }];
      assert.strictEqual(service.start(), true);
      var generatedDirectory = service.generatedConfigDirectory;
      var generatedPath = path.join(generatedDirectory, 'config.json');
      var generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
      assert.deepStrictEqual(JSON.parse(generated['credentials-contents']), service.credentials);
      assert.deepStrictEqual(generated.ingress, service.ingress);
      assert.strictEqual(fs.statSync(generatedPath).mode & 0o777, 0o600);
      assert.strictEqual(fs.statSync(generatedDirectory).mode & 0o777, 0o700);
      assert.ok(!service.tunnel.process.spawnargs.join(' ').includes('test-secret'));
      await new Promise(function(resolve) { service.tunnel.once('connected', resolve); });
      closed = new Promise(function(resolve) { service.tunnel.process.once('close', resolve); });
      service.stop();
      await closed;
      assert.ok(!fs.existsSync(generatedDirectory));

      // Execute permission succeeds, but the executable's interpreter does not exist.
      fs.writeFileSync(binary, '#!/nonexistent/casa-interpreter\n');
      assert.strictEqual(service.start(), true);
      await new Promise(function(resolve) { service.tunnel.process.once('close', resolve); });
      assert.strictEqual(service.status, 'retrying');
      assert.strictEqual(service.generatedConfigDirectory, null);
      assert.ok(service.restartTimer);
      service.stop();
      console.log('[PASS] Real npm wrapper: spawn, connection event, graceful stop and failed-spawn recovery on ' + process.version);
   }
   finally {
      clearTimeout(watchdog);
      service.stop();
      fs.rmSync(directory, { recursive: true, force: true });
   }
}
run().catch(function(error) { console.error(error); process.exitCode = 1; });
