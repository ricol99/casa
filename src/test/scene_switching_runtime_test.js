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
      // A generic forced write renews a live timer without changing manual mode.
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test' });
      await sleep(200);
      const durationProperty = building.properties['MANUAL-MODE-DURATION'];
      const modeProperty = building.properties.MODE;
      const timerBefore = modeProperty.stateTimer;
      assert(timerBefore);
      const durationEvents = [];
      const collectDuration = data => { if (data.name === 'MANUAL-MODE-DURATION') durationEvents.push(data); };
      building.on('property-changed', collectDuration);
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test' });
      await sleep(30);
      assert.strictEqual(modeProperty.stateTimer, timerBefore, 'ordinary equal write must not renew');
      assert.strictEqual(durationEvents.length, 0);
      const manualBeforeForce = manualSnapshot();
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test', forceUpdate: true });
      await waitFor('forced duration renewal', () => modeProperty.stateTimer !== timerBefore);
      assert.notStrictEqual(modeProperty.stateTimer, timerBefore, 'forced equal write must reset mode timer');
      assert(modeProperty.stateTimer.left() > 29000);
      assert.strictEqual(durationEvents.length, 1);
      assert.strictEqual(durationEvents[0].value, 30);
      assert.strictEqual(durationEvents[0].propertyOldValue, 30);
      assert.strictEqual(durationEvents[0].forceUpdate, undefined, 'listeners must not inherit the write flag');
      assert.deepStrictEqual(manualSnapshot(), manualBeforeForce);
      assert.strictEqual(durationProperty.alwaysUpdate(), false, 'force is not persisted');
      const renewedTimer = modeProperty.stateTimer;
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test' });
      await sleep(30);
      assert.strictEqual(modeProperty.stateTimer, renewedTimer, 'next ordinary write remains suppressed');
      assert.strictEqual(durationEvents.length, 1);
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test', forceUpdate: false });
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test', forceUpdate: 'true' });
      await sleep(30);
      assert.strictEqual(durationEvents.length, 1, 'only boolean true forces a write');
      durationProperty._alwaysUpdate = true;
      building.setProperty('MANUAL-MODE-DURATION', 30, { sourceName: 'force-update-test' });
      await waitFor('alwaysUpdate duration renewal', () => modeProperty.stateTimer !== renewedTimer);
      assert.notStrictEqual(modeProperty.stateTimer, renewedTimer, 'configured alwaysUpdate also passes both gates');
      delete durationProperty._alwaysUpdate;
      // Cross a real loopback Socket.IO connection using the production peer path.
      const PeerCasa = require('../peercasa');
      const server = require('http').createServer();
      const io = require('socket.io')(server);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const sender = Object.create(PeerCasa.prototype);
      sender.uName = ':remote-casa'; sender.casa = { uName: ':test-casa' };
      sender.connected = true; sender.incompleteRequests = {}; sender.reqId = 0;
      io.on('connection', socket => {
         const receiver = Object.create(PeerCasa.prototype);
         receiver.uName = ':test-casa'; receiver.gang = gang; receiver.casa = gang.casa; receiver.socket = socket;
         socket.on('console-command-req', data => receiver.socketConsoleCommandReqCb(data));
         socket.on('set-source-property-req', data => receiver.socketSetSourcePropertyReqCb(data));
         const publish = data => { if (!data.local) socket.emit('source-property-changed', data); };
         building.on('property-changed', publish);
         socket.on('disconnect', () => building.removeListener('property-changed', publish));
      });
      sender.socket = require('socket.io-client')('http://127.0.0.1:' + server.address().port, { reconnection: false });
      sender.updateSourceCommandProtocol();
      sender.socket.on('set-source-property-resp', data => sender.socketSetSourcePropertyRespCb(data));
      sender.socket.on('console-command-resp', data => sender.socketConsoleCommandRespCb(data));
      try {
         await new Promise((resolve, reject) => {
            sender.socket.once('connect', resolve);
            sender.socket.once('connect_error', reject);
         });
         const remote = Object.create(require('../peersource').prototype);
         remote.uName = building.uName; remote.casa = sender; remote.checkTransaction = () => 123;
         const beforeRemote = modeProperty.stateTimer;
         const metadata = { forceUpdate: true, sourceName: 'peer-test' };
         remote.setProperty('MANUAL-MODE-DURATION', 30, metadata);
         await waitFor('Socket.IO forced renewal', () => modeProperty.stateTimer !== beforeRemote && Object.keys(sender.incompleteRequests).length === 0);
         assert(modeProperty.stateTimer.left() > 29000);
         assert.deepStrictEqual(metadata, { forceUpdate: true, sourceName: 'peer-test' });
         assert.deepStrictEqual(manualSnapshot(), manualBeforeForce);
         const afterRemote = modeProperty.stateTimer;
         const eventsAfterRemote = durationEvents.length;
         remote.setProperty('MANUAL-MODE-DURATION', 30, {});
         await waitFor('Socket.IO ordinary write response', () => Object.keys(sender.incompleteRequests).length === 0);
         await sleep(30);
         assert.strictEqual(modeProperty.stateTimer, afterRemote);
         assert.strictEqual(durationEvents.length, eventsAfterRemote);
         console.error('[PASS] PeerSource and real Socket.IO forced renewal; ordinary writes and manual mode preserved');
         remote.fromPeer = true;
         remote.properties = {};
         Object.keys(building.properties).forEach(name => {
            const property = building.properties[name];
            remote.properties[name] = { type: 'property', valid: property.valid, cold: property.cold,
               value: building.getProperty(name), getValue() { return this.value; },
               getValueType() { return property.valueType; }, propertyAboutToChange(value) { return value; } };
         });
         remote.asyncEmit = function() {};
         const mirrorUpdate = data => remote.updateProperty(data.name, data.value, data);
         sender.socket.on('source-property-changed', mirrorUpdate);
         try {
            for (const entry of [[building, require('../consoleapis/sourceconsoleapi')], [remote, require('../consoleapis/peersourceconsoleapi')]]) {
               const target = entry[0];
               const api = Object.create(entry[1].prototype); api.myObj = () => target;
               const manualMcp = Object.create(require('../services/mcpservice').prototype);
               manualMcp.gang = { findNamedObject: () => target, casa: gang.casa };
               manualMcp.getConsoleApi = () => api;
               const manualCall = (name, args) => new Promise(resolve => manualMcp.handleToolCall(1,
                  { name: 'casa.' + name, arguments: Object.assign({ uName: target.uName }, args) }, { status() { return this; }, json: resolve }));
               let reply = await manualCall('release_manual_override');
               assert(!reply.error, JSON.stringify(reply));
               assert.strictEqual(reply.result.structuredContent.completed, true);
               reply = await manualCall('set_mode_manual', { duration: 30 });
               assert(!reply.error, JSON.stringify(reply));
               assert.strictEqual(reply.result.structuredContent.completed, true);
               await waitFor('manual timer starts', () => modeProperty.stateTimer && modeProperty.currentState.name === 'manual');
               const started = modeProperty.stateTimer;
               await manualCall('set_mode_manual', { duration: 60 });
               assert.strictEqual(modeProperty.stateTimer, started, 'set while manual must not renew');
               await sleep(30);
               reply = await manualCall('renew_manual_override', { duration: 30 });
               assert(!reply.error, JSON.stringify(reply));
               assert.notStrictEqual(modeProperty.stateTimer, started, 'MCP equal duration renewal must reach owner');
               assert(modeProperty.stateTimer.left() > 28000);
               assert.strictEqual(reply.result.structuredContent.completed, true);
               assert.strictEqual(target.getProperty('MODE-EXPIRES-AT'), building.getProperty('MODE-EXPIRES-AT'));
               assert.strictEqual(reply.result.structuredContent.controlStatus.returnToAuto.status, 'expected');
               assert.strictEqual(reply.result.structuredContent.controlStatus.manualOverride.status, 'timed');
               reply = await manualCall('release_manual_override');
               assert.strictEqual(reply.result.structuredContent.completed, true);
               assert.strictEqual(building.getProperty('MODE'), 'auto');
               assert.strictEqual(building.getProperty('MODE-EXPIRES-AT'), -1);
               assert.deepStrictEqual(manualSnapshot().slice(1), manualBeforeForce.slice(1));
               reply = await manualCall('set_mode_manual', { duration: 0.2 });
               assert.strictEqual(reply.result.structuredContent.controlStatus.manualOverride.status, 'timed');
               await waitFor('manual expiry clears mirrored timestamp', () => target.getProperty('MODE') === 'auto' && target.getProperty('MODE-EXPIRES-AT') === -1);

            }
            console.error('[PASS] Local and Socket.IO peer MCP manual set, equal-duration renewal and release');
         } finally { sender.socket.removeListener('source-property-changed', mirrorUpdate); }

      } finally {
         Object.keys(sender.incompleteRequests).forEach(id => sender.incompleteRequests[id].completeRequest(false));
         sender.socket.close();
         io.close();
      }
      building.removeListener('property-changed', collectDuration);
      building.setProperty('MANUAL-MODE-DURATION', -1, { sourceName: 'force-update-test' });
      await sleep(200);
      building.setProperty('MANUAL-MODE-ACTIVE', true, { sourceName: 'force-update-test' });
      await sleep(200);
      expectedManual = manualSnapshot(); manualChanges = [];
      console.error('[PASS] Local forceUpdate renews equal duration once; ordinary writes and manual mode preserved');
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
      assert.strictEqual(reply.result.structuredContent.scenes[0].durationSeconds, 0.5);
      assert.deepStrictEqual((await cmd('listScenes', [])).scenes, reply.result.structuredContent.scenes);
      reply = await call('set_scene', { uName: building.uName, scene: 'B' });
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
      reply = await call('set_scene', { uName: rooms[0].uName, scene: 'B' }); assert(reply.error);
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
      reply = await call('set_scene', { uName: building.uName, scene: 'B' });
      assert.strictEqual(reply.result.structuredContent.completed, true);
      await sleep(200);
      reply = await call('get_scene_status', { uName: building.uName });
      const roomStatus = reply.result.structuredContent.rooms.find(room => room.uName === rooms[0].uName);
      assert.strictEqual(roomStatus.mode, 'manual'); assert.strictEqual(roomStatus.sceneHasControl, false);
      assert.strictEqual(reply.result.structuredContent.selectedScene, 'b');
      await call('release_scene', { uName: building.uName });
      assert.deepStrictEqual(manualSnapshot(), expectedManual); assert.deepStrictEqual(manualChanges, []);
      console.error('[PASS] Four MCP scene tools and four console commands; building/room manual modes preserved');
      // A peer mirror has ordinary properties, no private mode configuration/timer.
      // Exercise the actual PeerSource.setProperty transport boundary with a test peer.
      const mirror = Object.create(require('../peersource').prototype);
      mirror.uName = building.uName; mirror.fromPeer = true; mirror.bowing = true;
      mirror.properties = {};
      Object.keys(building.properties).forEach(name => {
         const property = building.properties[name];
         mirror.properties[name] = { type: 'property', valid: true, cold: false,
            getValue: () => property.getValue() };
         Object.defineProperty(mirror.properties[name], 'value', { get: () => property.getValue() });
      });
      mirror.checkTransaction = () => 1;
      const writes = [];
      mirror.casa = { setSourceProperty(source, name, newValue, data) {
         writes.push(name);
         setTimeout(() => building.setProperty(name, newValue, data), 5);
      } };
      mcp.gang = Object.create(gang);
      mcp.gang.findNamedObject = name => name === building.uName ? mirror : gang.findNamedObject(name);
      const manualBeforePeer = manualSnapshot();
      reply = await call('list_scenes', { uName: mirror.uName });
      assert(!reply.error, JSON.stringify(reply));
      assert.deepStrictEqual(reply.result.structuredContent.scenes.map(item => item.name), ['a', 'b']);
      reply = await call('set_scene', { uName: mirror.uName, scene: 'B' });
      assert(!reply.error, JSON.stringify(reply));
      assert.strictEqual(reply.result.structuredContent.completed, true);
      reply = await call('get_scene_status', { uName: mirror.uName });
      assert.strictEqual(reply.result.structuredContent.selectedScene, 'b');
      assert.strictEqual(reply.result.structuredContent.expiry.status, 'unknown');
      reply = await call('release_scene', { uName: mirror.uName });
      assert.strictEqual(reply.result.structuredContent.completed, true);
      assert.strictEqual(building.getProperty('SCENE'), 'none');
      assert(writes.length > 0);
      assert(writes.every(name => name.endsWith('-SCENE-ACTIVE')));
      assert.deepStrictEqual(manualSnapshot(), manualBeforePeer);
      console.error('[PASS] Four scene tools through PeerSource property forwarding; manual overrides unchanged');
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
