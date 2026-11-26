// Exercise the real DB builder, loader, runtime and tester without external I/O.
// Only default DB destination, HTTP listening and discovery startup are isolated.
const fs = require('fs');
const os = require('os');
const path = require('path');
const child = require('child_process');
const src = path.resolve(__dirname, '../../..');
const mode = process.argv[2];
if (mode === 'build') {
   const dbDir = process.argv[4];
   const Db = require(path.join(src, 'db'));
   require.cache[require.resolve(path.join(src, 'db'))].exports = new Proxy(Db, {
      construct(target, args) {
         args[1] = dbDir;
         return Reflect.construct(target, args);
      }
   });
   process.argv = [process.execPath, path.join(src, 'utils/createdb.js'), process.argv[3]];
   require(path.join(src, 'utils/createdb'));
} else if (mode === 'runtime') {
   require(path.join(src, 'services/webservice')).prototype.startListening = function() {};
   require(path.join(src, 'services/casadiscoveryservice')).prototype.coldStart = function() {};
   const dbDir = process.argv[3];
   process.argv = [process.execPath, path.join(src, 'app.js'), '--nopeer', '--logs', 'error', '--config', dbDir, 'casa-config-guide'];
   require(path.join(src, 'app'));
} else {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'casa-authoring-'));
   const dbDir = path.join(root, 'db');
   fs.mkdirSync(dbDir);
   console.log('Disposable evidence directory: ' + root);
   const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'competing-machines.json'), 'utf8'));
   if (mode === 'capture') config.gang.things[1].generateExpectedOutput = Number(process.argv[3] || 1);
   const input = path.join(root, 'competing-machines.json');
   fs.writeFileSync(input, JSON.stringify(config, null, 2));
   const runs = [
      ['build-gang', ['build', path.join(__dirname, 'gang.json'), dbDir]],
      ['build-casa', ['build', input, dbDir]],
      ['runtime', ['runtime', dbDir]]
   ];
   for (const [name, args] of runs) {
      const r = child.spawnSync(process.execPath, [__filename, ...args], { cwd: src, encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
      fs.writeFileSync(path.join(root, name + '.log'), (r.stdout || '') + (r.stderr || ''));
      if (name === 'runtime' || r.status !== 0) process.stdout.write((r.stdout || '') + (r.stderr || ''));
      if (r.error || r.status !== 0) {
         console.error(r.error || ('Exit status ' + r.status));
         process.exit(1);
      }
   }
}
