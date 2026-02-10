// Upstairs
//var userId = "mCeDzqVmSty2ff3-mxi6LnGKe12HmCznuQ-k2uia";
//var linkId = "001788fffe6d3a92";
//var linkAddress = "192.168.1.10";

// Downstairs
//var userId = "kJixJg-98-G53FjSIp2D1QROfLBI8bVRZt-w4cPj";
//var linkId = "001788fffe62eec3";
//var linkAddress = "192.168.1.31";

// Garden Room
var userId = "mMjDsyJIS1oyr--gQxg0la4IXQWCny0bsl0rWWhS";
var linkId = "ecb5fafffe8ae380";
var linkAddress = "192.168.1.33";

var Hue = require("node-hue-api");

if (!linkAddress) {
   Hue.nupnpSearch(function(_err, _result) {

      if (!_err && _result.length > 0) {
         var bridge = findBridge(_result, linkId);

         if (bridge) {
            doIt(bridge.ipaddress);
         }
         else {

            try {
               Hue.upnpSearch(15000).then(bridgesFound).done();
            }
            catch(_error) {
               console.error(this.fullName + ": No bridges found!");
               process.exit(1);
            }
         }
      }
      else {
         try {
            Hue.upnpSearch(10000).then(bridgesFound).done();
         }
         catch(_error) {
            console.error(this.fullName + ": No bridges found!");
            process.exit(1);
         }
      }
   });
}
else {
   doIt(linkAddress);
}

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
      doIt(bridge.ipaddress);
   }
   else {
      console.error("AAAA No bridges found!");
      process.exit(1);
   }
}

function doIt(_linkAddress) {

   if (!_linkAddress) {
      console.error("Unable to find bridge, error=" + "Id " + linkId + " not Found!");
      process.exit(1);
   }
   console.log("IP Address="+_linkAddress);

   if (!userId) {
      createUser(_linkAddress);
      return;
   }

   var hue = new Hue.HueApi(_linkAddress, userId);

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
         hue.lights(function(_err, _result) {
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
      case "updateGroup":
         hue.updateGroup(process.argv[3], process.argv[4], process.argv.slice(5), (err, result) => {
            console.log("Group update result: " + JSON.stringify(_result, null, 2));
         });
         break;
      case "lightsUnavailable":
         hue.lights(function(_err, _result) {

            for (let x = 0; x < _result.lights.length; ++x) {
            //console.log(_result.lights[x].id);
               if (!_result.lights[x].state.reachable) {
                  console.log(_result.lights[x].id + "\t" + _result.lights[x].name);
               }
            }
            //console.log("Light Status: " + JSON.stringify(_result, null, 2));
         });
         break;
      default:
         hue.getLightStatus(process.argv[2], function(_err, _result) {
            console.log("Light Status: " + JSON.stringify(_result));
         });
      }
   }
}
 
function createUser(_linkAddress) {
   var hue = new Hue.HueApi();
   console.log("Hello");

   hue.createUser(_linkAddress, (_err, _userId) => {

	if (_err) { 
           console.error("Error: "+_err);
        }
        else {
           console.log("New user Id="+_userId);
        }
   });
}
