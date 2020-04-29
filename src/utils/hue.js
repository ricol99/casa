// Upstairs
//var userId = "mCeDzqVmSty2ff3-mxi6LnGKe12HmCznuQ-k2uia";
//var linkId = "001788fffe6d3a92";

// Downstairs
var userId = "kJixJg-98-G53FjSIp2D1QROfLBI8bVRZt-w4cPj";
var linkId = "001788fffe62eec3";


var linkAddress, Hue = require("node-hue-api");

Hue.nupnpSearch(function(_err, _result) {

   if (!_err && _result.length > 0) {
      var bridge = findBridge(_result, linkId);

      if (bridge) {
         doIt(bridge);
      }
      else {

         try {
            Hue.upnpSearch(15000).then(bridgesFound).done();
         }
         catch(_error) {
            console.error(this.uName + ": No bridges found!");
            process.exit(1);
         }
      }
   }
   else {
      try {
         Hue.upnpSearch(10000).then(bridgesFound).done();
      }
      catch(_error) {
         console.error(this.uName + ": No bridges found!");
         process.exit(1);
      }
   }
});

function fixIds(_bridges) {

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id.substr(6,4) !== "fffe") {
         _bridges[i].id = _bridges[i].id.substr(0,6) + "fffe" + _bridges[i].id.substr(6);
      }
   }
}

function findBridge(_bridges, _id) {

   for (var i = 0; i < _bridges.length; ++i) {
      console.log(_bridges[i].id);

      if (_bridges[i].id === _id) {
         console.log("FOUND!");
         return _bridges[i];
      }
   }

   return null;
}

function bridgesFound(_bridges) {
   fixIds(_bridges);
   var bridge = findBridge(_bridges, linkId);

   if (bridge) {
      doIt(bridge);
   }
   else {
      console.error("AAAA No bridges found!");
      process.exit(1);
   }
}

function doIt(_bridge) {
   linkAddress = _bridge.ipaddress;

   if (!linkAddress) {
      console.error("Unable to find bridge, error=" + "Id " + linkId + " not Found!");
      process.exit(1);
   }
   console.log("IP Address="+linkAddress);

   var hue = new Hue.HueApi(linkAddress, userId);

   if (process.argv.length === 2 ) {

      hue.lights(function(_err, _result) {
         for (var i = 0; i < _result.lights.length; ++i) {
            console.log(_result.lights[i].id + "\t" + _result.lights[i].name);
         }
         console.log("Lights: " + JSON.stringify(_result, null, 2));
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
      case "createGroup":
         hue.createGroup(process.argv[3], process.argv.slice(4), (err, result) => {
            console.log("Group creation result: " + JSON.stringify(_result, null, 2));
         });
         break;
      case "deleteGroup":
         hue.deleteGroup(process.argv[3], (err, result) => {
            console.log("Group deletion result: " + JSON.stringify(_result, null, 2));
         });
         break;
      default:
         hue.getLightStatus(process.argv[2], function(_err, _result) {
            console.log("Light Status: " + JSON.stringify(_result));
         });
      }
   }
}
 
