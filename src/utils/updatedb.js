var util = require('../util');
var Db = require('../db');

var dbName = process.env['HOME']+'/.casa-keys/secure-config/'+process.argv[2]+".db";

var configFilename = process.argv[3];
var inputConfig = require('./' + configFilename);

var db = new Db(dbName);

db.on('connected', () => {
   updateDbFromConfig();
});

function updateDbFromConfig() {

   if (inputConfig instanceof Array ) {
      updateItems(0);
   }
   else {
      db.update(inputConfig, (_err, _res) => {

         if (_err) {
            console.error("Failed. Error=" + _err);
            db.close();
            process.exit(1);
         }
         db.close();
      });
   }
}

function updateItems(_index) {

   if (_index < inputConfig.length) {

      db.update(inputConfig[_index], (_err, _res) => {

         if (_err) {
            console.error("Failed. Error=" + _err);
            db.close();
            process.exit(1);
         }

         updateItems(_index + 1);
      });
   }
   else {
      db.close();
   }
}
