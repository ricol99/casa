var util = require('../util');
var Db = require('../db');
var cjson = require('cjson');

var configFilename = process.argv[2];
var inputConfig = cjson.load(configFilename);
parseConfigForSecureConfig(inputConfig);

var gangDb = inputConfig.hasOwnProperty("gang");

var db = new Db((gangDb) ? inputConfig.gang.name : inputConfig.casa.name, undefined, true);

db.on('connected', () => {
   populateDbFromConfig();
});

db.connect();

function populateDbFromConfig() {

   var configs = {};
   configs.gang = { "name": "", "type": "", "displayName": "", "parentCasa": {} };
   configs.casa = { "name": "", "type": "", "displayName": "", "location": {}, "gang": "", "listeningPort": 0 };
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

