var util = require('../util');
var Db = require('../db');

var configFilename = process.argv[2];

const fs = require('fs');
const json5 = require('json5');
const jsonStr = fs.readFileSync(configFilename, 'utf8');
var inputConfig = json5.parse(jsonStr);

parseConfigForSecureConfig(inputConfig);

var casaDb = inputConfig.hasOwnProperty("casa");
populateDbFromConfig(inputConfig, casaDb);

function populateDbFromConfig(_inputConfig, _casaDb) {
   var db = new Db(_casaDb ? _inputConfig.casa.name+"-db" : _inputConfig.gang.name+"-db", undefined, true);

   db.on('connected', () => {
      var collections = {};
      var writeAdditionalGangDb = false;

      if (_casaDb) {
         collections.casa = { "name": "", "type": "", "displayName": "", "location": {}, "listeningPort": 0 };

         for (var param in collections.casa) {

            if (_inputConfig.casa.hasOwnProperty(param)) {
               collections.casa[param] = _inputConfig.casa[param];
            }
         }

         collections.casaServices = _inputConfig.hasOwnProperty("casaServices") ? _inputConfig.casaServices : _inputConfig.casa.hasOwnProperty("services") ? _inputConfig.casa.services : [];
         collections.casaScenes = _inputConfig.hasOwnProperty("casaScenes") ? _inputConfig.casaScenes : _inputConfig.casa.hasOwnProperty("scenes") ? _inputConfig.casa.scenes : [];
         collections.casaThings = _inputConfig.hasOwnProperty("casaThings") ? _inputConfig.casaThings : _inputConfig.casa.hasOwnProperty("things") ? _inputConfig.casa.things : [];
         collections.casaUsers = _inputConfig.hasOwnProperty("casaUsers") ? _inputConfig.casaUsers : _inputConfig.casa.hasOwnProperty("users") ? _inputConfig.casa.users : [];

         if (_inputConfig.hasOwnProperty("gang")) {
            collections.casa.gang = _inputConfig.gang.name;
            collections.gangThings = _inputConfig.hasOwnProperty("gangThings") ? _inputConfig.gangThings : _inputConfig.gang.hasOwnProperty("things") ? _inputConfig.gang.things : [];
            collections.gangServices = _inputConfig.hasOwnProperty("gangServices") ? _inputConfig.gangServices : _inputConfig.gang.hasOwnProperty("services") ? _inputConfig.gang.services : [];
            collections.gangScenes = _inputConfig.hasOwnProperty("gangScenes") ? _inputConfig.gangScenes : _inputConfig.gang.hasOwnProperty("scenes") ? _inputConfig.gang.scenes : [];
         }
         else if (_inputConfig.casa.hasOwnProperty("gang")) { 
            collections.casa.gang = _inputConfig.casa.gang;
            collections.gangThings = _inputConfig.hasOwnProperty("gangThings") ? _inputConfig.gangThings : [];
            collections.gangServices = _inputConfig.hasOwnProperty("gangServices") ? _inputConfig.gangServices : [];
            collections.gangScenes = _inputConfig.hasOwnProperty("gangScenes") ? _inputConfig.gangScenes : [];
         }
         else {
            collections.casa.gang = collections.casa.name + "-gang";
            collections.gangThings = [];
            collections.gangServices = [];
            collections.gangScenes = [];
            writeAdditionalGangDb = true;
         }
      }
      else {
         collections.gang = { "name": "", "type": "", "displayName": "", "parentCasa": {} };

         for (var param in collections.gang) {

            if (_inputConfig.gang.hasOwnProperty(param)) {
               collections.gang[param] = _inputConfig.gang[param];
            }
         }

         collections.gangUsers = _inputConfig.hasOwnProperty("gangUsers") ? _inputConfig.gangUsers : _inputConfig.gang.hasOwnProperty("users") ? _inputConfig.gang.users : [];
         collections.gangServices = _inputConfig.hasOwnProperty("gangServices") ? _inputConfig.gangServices : _inputConfig.gang.hasOwnProperty("services") ? _inputConfig.gang.services : [];
         collections.gangScenes = _inputConfig.hasOwnProperty("gangScenes") ? _inputConfig.gangScenes : _inputConfig.gang.hasOwnProperty("scenes") ? _inputConfig.gang.scenes : [];
         collections.gangThings = _inputConfig.hasOwnProperty("gangThings") ? _inputConfig.gangThings : _inputConfig.gang.hasOwnProperty("things") ? _inputConfig.gang.things : [];
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

         if (writeAdditionalGangDb) {
            var gangConfig = { gang: { "name": collections.casa.name + "-gang", "type": "gang", "displayName": "Gang for " + collections.casa.name, "parentCasa": {} }};
            populateDbFromConfig(gangConfig, false);
         }
      });
   });

   db.connect();
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

