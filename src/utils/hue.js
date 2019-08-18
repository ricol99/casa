//var userId = "0hpXbPLf7y5aPenmJrE8-UXYEoqdCMvK5osyAt6w",
var userId = "kJixJg-98-G53FjSIp2D1QROfLBI8bVRZt-w4cPj",
    linkId = "001788fffe62eec3",
    //linkId = "001788fffe6d3a92",
    linkAddress,
    Hue = require("node-hue-api");

var displayUserResult = function(_result) {
    console.log("Created user: " + JSON.stringify(_result));
};
 
var displayError = function(_err) {
    console.log("Unable to create user. Error="+ _err);
};

Hue.nupnpSearch(function(_err, _result) {

   //if (_err || _bridges.length == 0) {
      //console.error("Unable to find bridge, error=" + _err ? _err : "None Found!");
      //process.exit(1);
   //}

   try {
      Hue.upnpSearch(10000).then(bridgesFound).done();
   }
   catch(_error) {
      console.error(this.uName + ": No bridges found!");
      process.exit(1);
   }
});

function fixIds(_bridges) {

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id.substr(6,4) !== "fffe") {
         _bridges[i].id = _bridges[i].id.substr(0,6) + "fffe" + _bridges[i].id.substr(6);
      }
   }
}

function bridgesFound(_bridges) {
   console.log(_bridges);
   fixIds(_bridges);

   for (var i = 0; i < _bridges.length; ++i) {
      console.log(_bridges[i].id);
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
         for (var i = 0; i < _result.lights.length; ++i) {
            console.log(_result.lights[i].id + "\t" + _result.lights[i].name);
         }
         //console.log("Lights: " + JSON.stringify(_result, null, 2));
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
      default:
         hue.getLightStatus(process.argv[2], function(_err, _result) {
            console.log("Light Status: " + JSON.stringify(_result));
         });
      }
   }
}
 
