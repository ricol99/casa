var util = require('../util');
var Db = require('../db');

var configFilename = process.argv[2];
var inputConfig = require('./' + configFilename);
var gangDb = inputConfig.hasOwnProperty("gang");

var dbName = process.env['HOME']+'/.casa-keys/secure-config/' + ((gangDb) ? inputConfig.gang.uName.split(":")[1]+"-gang" : inputConfig.casa.uName.split(":")[1]) + ".db";
var db = new Db(dbName);

db.on('connected', () => {
   populateDbFromConfig();
});

function populateDbFromConfig() {

   var configs = {};
   configs.gang = { "uName": "", "displayName": "" };
   configs.casa = { "uName": "", "displayName": "", "location": {}, "gang": "", "listeningPort": 0, "parentCasa": {} };
   configs.users = [];
   configs.services = [];
   configs.scenes = [];
   configs.things = [];

   for (var section in configs) {

      if (configs.hasOwnProperty(section) && inputConfig.hasOwnProperty(section)) {

         if (configs[section] instanceof Array || (paramCount(configs[section]) === 0)) {

            if (inputConfig.hasOwnProperty(section)) {
               configs[section] = inputConfig[section];
               db.appendToCollection(section, configs[section]);
            }
         }
         else {
            for (var param in configs[section]) {

               if (inputConfig.hasOwnProperty(section) && inputConfig[section].hasOwnProperty(param)) {
                  configs[section][param] = inputConfig[section][param];
               }
            }
            db.appendToCollection(section, configs[section]);
         }
      }

   }

   db.readCollection("things", function(_err, _res) {

      if (_err) {
         console.error("Failed to read from database. Error="+_err);
         db.close();
         process.exit(1);
      }

      db.close();
   });

}

function paramCount(_obj) {
   var count = 0;

   for (var param in _obj) {

      if (_obj.hasOwnProperty(param)) {
         ++count;
      }
   }

   return count;
}
