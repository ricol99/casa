var util = require('../util');
var Db = require('../db');
var cjson = require('cjson');

var configFilename = process.argv[2];
var inputConfig = cjson.load(configFilename);
parseConfigForSecureConfig(inputConfig);

var casaDb = inputConfig.hasOwnProperty("casa");
var db = new Db(casaDb ? inputConfig.casa.name : inputConfig.gang.name, undefined, true);

db.on('connected', () => {
   populateDbFromConfig();
});

db.connect();

function populateDbFromConfig() {

   var collections = {};

   if (casaDb) {
      collections.casa = { "name": "", "type": "", "displayName": "", "location": {}, "listeningPort": 0 };

      for (var param in collections.casa) {

         if (inputConfig.casa.hasOwnProperty(param)) {
            collections.casa[param] = inputConfig.casa[param];
         }
      }

      collections.casa.gang = inputConfig.gang.name;
      collections.casaServices = inputConfig.casa.hasOwnProperty("services") ? inputConfig.casa.services : [];
      collections.casaScenes = inputConfig.casa.hasOwnProperty("scenes") ? inputConfig.casa.scenes : [];
      collections.casaThings = inputConfig.casa.hasOwnProperty("things") ? inputConfig.casa.things : [];
      collections.gangThings = inputConfig.gang.hasOwnProperty("things") ? inputConfig.gang.things : [];
   }
   else {
      collections.gang = { "name": "", "type": "", "displayName": "", "parentCasa": {} };

      for (var param in collections.gang) {

         if (inputConfig.gang.hasOwnProperty(param)) {
            collections.gang[param] = inputConfig.gang[param];
         }
      }

      collections.gangUsers = inputConfig.gang.hasOwnProperty("users") ? inputConfig.gang.users : [];
      collections.gangScenes = inputConfig.gang.hasOwnProperty("scenes") ? inputConfig.gang.scenes : [];
      collections.gangThings = inputConfig.gang.hasOwnProperty("things") ? inputConfig.gang.things : [];
   }

   for (var collection in collections) {

      if (collections.hasOwnProperty(collection)) {
         db.appendToCollection(collection, collections[collection]);
      }
   }

   db.readCollection("gangThings", function(_err, _res) {

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

function parseConfigForSecureConfig(_config) {

   if (_config instanceof Array) {

      for (var i = 0; i < _config.length; ++i) {
         parseConfigForSecureConfig(_config[i]);
      }
   }
   else if (_config.hasOwnProperty("secureConfig") && _config.secureConfig) {
      loadSecureConfig(_config.name, _config);
   }
   else {
      for (var prop in _config) {

         if (_config.hasOwnProperty(prop) &&  (typeof _config[prop] === 'object')) {
            parseConfigForSecureConfig(_config[prop]);
         }
      }
   }
}

function loadSecureConfig(_name, _config) {
   var secureConfig = secureRequire(_name);

   if (!secureConfig) {
      return;
   }

   for (var conf in secureConfig) {

      if (secureConfig.hasOwnProperty(conf)) {

         if (_config.hasOwnProperty(conf)) {

            if (Array.isArray(_config[conf]) && Array.isArray(secureConfig[conf])) {

               for (var i = 0; i < secureConfig[conf].length; ++i) {
                  _config[conf].push(secureConfig[conf][i]);
               }
            }
         }
         else {
            _config[conf] = secureConfig[conf];
         }
      }
   }

   return secureConfig;
}

function secureRequire(_name) {
   return require(process.env['HOME']+'/.casa-keys/secure-config/' + _name);
};

