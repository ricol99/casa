var linkId, linkAddress,
    Hue = require("node-hue-api");

var displayUserResult = function(_result) {
    console.log("Created user: " + JSON.stringify(_result));
};
 
var displayError = function(_err) {
    console.log("Unable to create user. Error="+ _err);
};
 

try {
   Hue.upnpSearch(3000).then(bridgesFound).done();
}
catch(_error) {
   console.error("No bridges found! Error =", _err);
   process.exit(1);
}

function bridgesFound(_bridges) {

   if (process.argv.length == 2) {
      console.log("Hue Bridges Found: " + JSON.stringify(_bridges));
      console.log("Re-run this command stating the id of the link you want to register with");
      process.exit(1);
   }

   linkId = process.argv[2];

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

   var hue = new Hue.HueApi();

   hue.registerUser(linkAddress, "Casa Home Automation")
    .then(displayUserResult)
    .fail(displayError)
    .done();

};
 
// -------------------------- 
// Using a callback (with default description and auto generated username) 
//hue.createUser(hostname, function(err, user) {
    //if (err) throw err;
    //displayUserResult(user);
//});
