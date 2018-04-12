var Gang = require('./dummygang');
var gang = new Gang({});

var LightWaveRF = require('../services/lightwaverfservice');
LightWaveRF.setGang(gang);

var lrf = new LightWaveRF({ name: "lightwaverservice:utility", linkAddress: "192.168.1.49" });
lrf.coldStart();

var roomId = process.argv[2];
var deviceId = process.argv[3];
var action = process.argv[4];
var param = process.argv[5];

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

   case "dim":
      lrf.setDeviceDim(roomId, deviceId, param, (_err, _result) => {
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
