var userId = "0hpXbPLf7y5aPenmJrE8-UXYEoqdCMvK5osyAt6w",
    linkId = "001788fffe6d3a92",
    linkAddress,
    Hue = require("node-hue-api");

var displayUserResult = function(_result) {
    console.log("Created user: " + JSON.stringify(_result));
};
 
var displayError = function(_err) {
    console.log("Unable to create user. Error="+ _err);
};
 
Hue.nupnpSearch(function(_err, _bridges) {

   if (_err || _bridges.length == 0) {
      console.error("Unable to find bridge, error=" + _err ? _err : "None Found!");
      process.exit(1);
   }

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id == linkId) {
         linkAddress = _bridges[i].ipaddress;
         break;
      }
   }

   if (!linkAddress) {
      console.error("Unable to find bridge, error=" + "Id " + linkId + " not Found!");
      process.exit(1);
   }

   var hue = new Hue.HueApi(linkAddress, userId);

   if (process.argv.length == 2 ) {
      hue.lights(function(_err, _result) {
         console.log("Lights: " + JSON.stringify(_result));
      });
   }
   else {
      switch (process.argv[2]) {
      case "lights":
         hue.getLightStatus(process.argv[2], function(_err, _result) {
            console.log("Light Status: " + JSON.stringify(_result));
         });
         break;
      case "groups":
         hue.lightGroups(function(_err, _result) {
            console.log("Group Status: " + JSON.stringify(_result));
         });
         break;
      case "scenes":
         hue.scenes(function(_err, _result) {
            console.log("Scene Status: " + JSON.stringify(_result, null, 2));
         });
         break;
      default:
         hue.getLightStatus(process.argv[2], function(_err, _result) {
            console.log("Light Status: " + JSON.stringify(_result));
         });
      }
   }
});
 
