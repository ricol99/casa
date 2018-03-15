var CasaSystem = require('../casasystem');
casaSys = new CasaSystem({}, {"name": "casa:util", "displayName": "Utility Casa", "gang": "casa-collin-v2", "listeningPort": 8097}, false, false, null, null, 1);

var LightWaveRF = require('../services/lightwaverfservice');
var lrf = new LightWaveRF({ name: "lightwaverservice:utility", linkAddress: "192.168.1.49" });
lrf.coldStart();

var roomId = process.argv[2];
var deviceId = process.argv[3];
var action = process.argv[4];

console.log('Performing action "'+action+'" on device '+deviceId+' in room '+roomId);

switch (action) {
   case "on":
      lrf.turnDeviceOn(roomId, deviceId, (_err, _result) => {
         if (_err) {
            console.error('Error=',_err);
            process.exit(1);
         }
         else {
            console.info('Done');
            process.exit(0);
         }
      });
      break;

   case "off":
      lrf.turnDeviceOff(roomId, deviceId, (_err, _result) => {
         if (_err) {
            console.error('Error=',_err);
            process.exit(1);
         }
         else {
            console.info('Done');
            process.exit(0);
         }
      });
      break;
}
