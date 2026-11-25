// Real building/room scene integration, using disposable databases and no hardware.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const child = require('child_process');
const src = path.resolve(__dirname, '..');
const mode = process.argv[2];
if (mode === 'build') {
   const Db = require('../db');
   const dbDir = process.argv[4];
   const input = process.argv[3];
   require.cache[require.resolve('../db')].exports = new Proxy(Db, {
      construct(target, args) { args[1] = dbDir; return Reflect.construct(target, args); }
   });
   process.argv = [process.execPath, path.join(src, 'utils/createdb.js'), input];
   require('../utils/createdb');
} else if (mode === 'runtime') {
   require('../services/webservice').prototype.startListening = function() {};
   require('../services/casadiscoveryservice').prototype.coldStart = function() {};
   process.argv = [process.execPath, path.join(src, 'app.js'), '--nopeer', '--logs', 'error', '--config', process.argv[3], 'casa-scene-test'];
   require('../app');
   const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
   async function waitFor(label, predicate) {
      const end = Date.now() + 5000;
      while (Date.now() < end) { if (predicate()) return; await sleep(20); }
      throw new Error('Timed out: ' + label);
   }
   (async function() {
      let gang;
      let building, rooms;
      await waitFor('startup', () => {
         gang = require('../gang').mainInstance();
         if (!gang) return false;
         building = gang.findNamedObject(':scene-building');
         rooms = ['room-a', 'room-b'].map(name => gang.findNamedObject(':' + name));
         return building && rooms.every(room => room && room.properties.MODE && room.properties.MODE.valid && !room.properties.MODE.cold) &&
            building.properties.SCENE && building.properties.SCENE.valid && !building.properties.SCENE.cold;
      });
      const all = [building].concat(rooms);
      const value = (obj, name) => obj.getProperty(name);
      const manualSnapshot = () => all.map(obj => [value(obj, 'MODE'), value(obj, 'MANUAL-MODE-ACTIVE'), value(obj, 'MANUAL-MODE-DURATION')]);
      await waitFor('normal outputs', () => rooms.every(room => value(room, 'test-output') === 'normal'));
      let expectedManual = manualSnapshot();
      let manualChanges = [];
      const manualValues = new Map();
      all.forEach(obj => ['MODE', 'MANUAL-MODE-ACTIVE', 'MANUAL-MODE-DURATION'].forEach(name => manualValues.set(obj.name + ':' + name, value(obj, name))));
      all.forEach(obj => obj.on('property-changed', data => {
         const key = obj.name + ':' + data.name;
         if (manualValues.has(key) && manualValues.get(key) !== data.value) {
            manualChanges.push([obj.name, data.name, data.value]);
            manualValues.set(key, data.value);
         }
      }));
      function button(name, on) { building.setProperty(name.toUpperCase() + '-SCENE-ACTIVE', on, { sourceName: 'scene-test' }); }
      function snapshot() { return { scene: value(building, 'SCENE'), a: value(building, 'A-SCENE-ACTIVE'), b: value(building, 'B-SCENE-ACTIVE'), count: value(building, 'SCENE-ACTIVES-POSITIVE-COUNT'), rooms: rooms.map(room => [value(room, 'BUILDING-SCENE'), value(room, 'test-output')]), manual: manualSnapshot() }; }
      async function check(label, scene) {
         try {
            await waitFor(label, () => value(building, 'SCENE') === scene &&
               value(building, 'A-SCENE-ACTIVE') === (scene === 'a') && value(building, 'B-SCENE-ACTIVE') === (scene === 'b') &&
               value(building, 'SCENE-ACTIVES-POSITIVE-COUNT') === (scene === 'none' ? 0 : 1) &&
               rooms.every(room => value(room, 'BUILDING-SCENE') === scene && value(room, 'test-output') === (scene === 'none' ? 'normal' : scene)));
            await sleep(150);
            assert.strictEqual(value(building, 'SCENE'), scene);
            assert.deepStrictEqual(manualSnapshot(), expectedManual);
            assert.deepStrictEqual(manualChanges, [], 'scene operation changed manual mode');
            console.error('[PASS] ' + label + ' ' + JSON.stringify(snapshot()));
         } catch (error) { console.error('FAILED SNAPSHOT ' + JSON.stringify(snapshot())); throw error; }
      }
      button('a', true); await check('select A', 'a');
      button('b', true); await check('switch A to B', 'b');
      button('b', false); await check('release B to normal', 'none');
      button('a', true); button('b', true);
      await check('simultaneous A then B selects B', 'b');
      button('a', false); button('b', false); await check('release both', 'none');
      button('b', true); button('a', true);
      await check('simultaneous B then A selects A', 'a');
      button('a', false); await check('release reverse selection', 'none');
      for (let i = 0; i < 10; ++i) { button('a', true); await sleep(10); button('b', true); await sleep(10); }
      await check('rapid switching ending B selects B', 'b');
      for (let i = 0; i < 10; ++i) { button('b', true); await sleep(10); button('a', true); await sleep(10); }
      await check('rapid switching ending A selects A', 'a');
      button('a', false); button('b', false); await check('release after rapid switching', 'none');
      building.alignPropertyValue('A-SCENE-DURATION', 0.5);
      button('a', true); await check('timed scene enters', 'a');
      await check('scene timeout restores normal', 'none');
      // A pre-existing manual override must also remain untouched by scene selection.
      building.setManualMode();
      await waitFor('pre-existing building manual override', () => value(building, 'MODE') === 'manual');
      await sleep(200);
      expectedManual = manualSnapshot(); manualChanges = [];
      button('b', true); await check('scene with existing manual override', 'b');
      for (let i = 0; i < 10; ++i) { button('a', true); await sleep(10); button('b', true); await sleep(10); }
      await check('rapid switching preserves existing manual override and selects B', 'b');
      button('b', false); await check('release preserves existing manual override', 'none');
      // Exercise MCP and console commands through the runtime's paired Building API.
      const mcp = Object.create(require('../services/mcpservice').prototype); mcp.gang = gang;
      const call = (name, args) => new Promise(resolve => mcp.handleToolCall(1, { name: 'casa.' + name, arguments: args }, {
         status() { return this; }, json: resolve
      }));
      const command = Object.create(require('../consolecmds/buildingconsolecmd').prototype);
      command.console = { write() {} };
      command.executeParsedCommand = (name, args, cb) => mcp.invokeConsoleCommand(building, name, args, cb);
      const cmd = (name, args) => new Promise((resolve, reject) => command[name](args, (err, result) => err ? reject(new Error(String(err))) : resolve(result)));
      let reply = await call('list_scenes', { uName: building.uName });
      assert(!reply.error, JSON.stringify(reply));
      assert.deepStrictEqual(reply.result.structuredContent.scenes.map(scene => scene.name), ['a', 'b']);
      assert.strictEqual(reply.result.structuredContent.scenes[0].defaultDurationSeconds, -1);
      assert.deepStrictEqual((await cmd('listScenes', [])).scenes, reply.result.structuredContent.scenes);
      reply = await call('set_scene', { uName: building.uName, scene: 'b' });
      assert(!reply.error, JSON.stringify(reply));
      assert.strictEqual(reply.result.structuredContent.completed, true);
      await check('MCP set scene preserves manual override', 'b');
      reply = await call('get_scene_status', { uName: building.uName });
      assert.strictEqual(reply.result.structuredContent.selectedScene, 'b');
      assert.strictEqual(reply.result.structuredContent.expiry.status, 'indefinite');
      assert.strictEqual(reply.result.structuredContent.rooms.length, 2);
      assert(reply.result.structuredContent.rooms.every(room => room.sceneHasControl === true));
      assert.strictEqual((await cmd('getSceneStatus', [])).selectedScene, 'b');
      reply = await call('set_scene', { uName: building.uName, scene: 'missing' }); assert(reply.error);
      reply = await call('set_scene', { uName: building.uName }); assert.strictEqual(reply.error.code, -32602);
      reply = await call('set_scene', { uName: rooms[0].uName, scene: 'b' }); assert(reply.error);
      assert.deepStrictEqual(manualSnapshot(), expectedManual);
      assert.strictEqual((await cmd('releaseScene', [])).completed, true);
      await check('console release preserves manual override', 'none');
      assert.strictEqual((await cmd('setScene', ['b'])).completed, true);
      await check('console set preserves manual override', 'b');
      reply = await call('release_scene', { uName: building.uName });
      assert.strictEqual(reply.result.structuredContent.completed, true);
      await check('MCP release preserves manual override', 'none');
      for (const name of ['listScenes', 'getSceneStatus', 'setScene', 'releaseScene']) assert.strictEqual(await cmd(name, ['--help']), true);
      await assert.rejects(cmd('setScene', []));
      await assert.rejects(cmd('releaseScene', ['b']));
      // Room manual control is reported separately from the building selection.
      rooms[0].setManualMode();
      await waitFor('room manual', () => value(rooms[0], 'MODE') === 'manual');
      await sleep(200); expectedManual = manualSnapshot(); manualChanges = [];
      reply = await call('set_scene', { uName: building.uName, scene: 'b' });
      assert.strictEqual(reply.result.structuredContent.completed, true);
      await sleep(200);
      reply = await call('get_scene_status', { uName: building.uName });
      const roomStatus = reply.result.structuredContent.rooms.find(room => room.uName === rooms[0].uName);
      assert.strictEqual(roomStatus.mode, 'manual'); assert.strictEqual(roomStatus.sceneHasControl, false);
      assert.strictEqual(reply.result.structuredContent.selectedScene, 'b');
      await call('release_scene', { uName: building.uName });
      assert.deepStrictEqual(manualSnapshot(), expectedManual); assert.deepStrictEqual(manualChanges, []);
      console.error('[PASS] Four MCP scene tools and four console commands; building/room manual modes preserved');
      console.error('[PASS] All scene switching integration checks');
      process.exit(0);
   })().catch(error => { console.error(error.stack); process.exit(1); });
} else {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'casa-scene-switching-'));
   const db = path.join(root, 'db'); fs.mkdirSync(db);
   function room(name) { return { name: name, type: 'room', building: ':scene-building', users: [], properties: [
      { name: 'test-output', valueType: 'string', initialValue: 'normal', propagation: 'private' },
      { name: 'normal-output', type: 'stateproperty', initialValue: 'normal', states: [{ name: 'normal', priority: 10, action: { property: 'test-output', value: 'normal' } }] },
      { name: 'BUILDING-SCENE', type: 'stateproperty', ignoreControl: true, takeControlOnTransition: true, source: { uName: ':scene-building', property: 'SCENE' }, states: [
         { name: 'none', priority: -100 }, { name: 'a', priority: 20, action: { property: 'test-output', value: 'a' } },
         { name: 'b', priority: 30, action: { property: 'test-output', value: 'b' } }
      ] }
   ] }; }
   const fixtures = [ { gang: { name: 'gang-scene-test', type: 'gang' } }, {
      casa: { name: 'casa-scene-test', type: 'casa', listeningPort: 50996, services: [], things: [], scenes: [] },
      gang: { name: 'gang-scene-test', things: [
         { name: 'scene-building', type: 'building', users: [], scenes: [{ name: 'a', priority: 20 }, { name: 'b', priority: 30 }], properties: [
            { name: 'daylight', initialValue: true, valueType: 'boolean' }, { name: 'low-light', initialValue: false, valueType: 'boolean' }
         ] }, room('room-a'), room('room-b')
      ] }
   } ];
   console.log('Evidence: ' + root);
   fixtures.forEach((fixture, i) => {
      const file = path.join(root, 'fixture-' + i + '.json'); fs.writeFileSync(file, JSON.stringify(fixture));
      const r = child.spawnSync(process.execPath, [__filename, 'build', file, db], { cwd: src, encoding: 'utf8', timeout: 15000 });
      fs.writeFileSync(path.join(root, 'build-' + i + '.log'), (r.stdout || '') + (r.stderr || ''));
      assert.strictEqual(r.status, 0, 'DB build failed: ' + r.stderr);
   });
   const r = child.spawnSync(process.execPath, [__filename, 'runtime', db], { cwd: src, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
   fs.writeFileSync(path.join(root, 'runtime.log'), (r.stdout || '') + (r.stderr || ''));
   process.stdout.write(r.stderr || '');
   if (r.error) console.error(r.error);
   process.exit(r.status === 0 ? 0 : 1);
}
