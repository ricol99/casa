var util = require('../util');
var cjson = require('cjson');

var file1 = process.argv[2];
var file1Config = cjson.load(file1);

if (file1Config.hasOwnProperty("gangThings")) {

   if (file1Config.hasOwnProperty("gang")) {
      file1Config.gang.things = file1Config.gangThings;
   }
   else  {
      file1Config.gang = { name: file1Config.casa.gang, things: file1Config.gangThings };
   }
   delete file1Config.gangThings;
}

if (file1Config.hasOwnProperty("casaThings")) {
   file1Config.casa.things = file1Config.casaThings;
   delete file1Config.casaThings;
}

if (file1Config.hasOwnProperty("casaServices")) {
   file1Config.casa.services = file1Config.casaServices;
   delete file1Config.casaServices;
}

if (file1Config.hasOwnProperty("casaScenes")) {
   file1Config.casa.scenes = file1Config.casaScenes;
   delete file1Config.casaScenes;
}

if (file1Config.hasOwnProperty("casaUsers")) {
   file1Config.casa.users = file1Config.casaUsers;
   delete file1Config.casaUsers;
}

if (file1Config.hasOwnProperty("gangUsers")) {
   file1Config.gang.users = file1Config.gangUsers;
   delete file1Config.gangUsers;
}

pluralise(file1Config, "action", "actions");
pluralise(file1Config, "guard", "guards");
pluralise(file1Config, "source", "sources");
sortArrays(file1Config);

console.log(util.inspect(file1Config,{depth:50}));

function pluralise(_obj, _fieldName, _pluralFieldName) {

   for (var field in _obj) {

      if (_obj.hasOwnProperty(field)) {

         if (Array.isArray(_obj[field]) && _obj[field]) {

            for (var i = 0; i < _obj[field].length; ++i) {
               pluralise(_obj[field][i], _fieldName, _pluralFieldName);
            }
         }
         else {

            if (field === _fieldName) {
               _obj[_pluralFieldName] = [_obj[field]];
               delete _obj[field];

               if ((typeof _obj[_pluralFieldName] === 'object') && (_obj[_pluralFieldName] !== null)) {
                  pluralise(_obj[_pluralFieldName], _fieldName, _pluralFieldName);
               }
            }

            if ((typeof _obj[field] === 'object') && (_obj[field] !== null)) {
               pluralise(_obj[field], _fieldName, _pluralFieldName);
            }
         }
      }
   }
}

function sortArrays(_obj) {

   for (var field in _obj) {

      if (_obj.hasOwnProperty(field)) {

         if (Array.isArray(_obj[field]) && _obj[field]) {

            if ((_obj[field].length > 1) && (typeof _obj[field][0] === 'object') && !Array.isArray(_obj[field][0])) {

               _obj[field].sort((_a, _b) => {
                  //console.log(_a,_b);

                  if (_a.hasOwnProperty("name") && _b.hasOwnProperty("name")) {
                     return _a.name > _b.name;
                  }
                  else {
                     return _a - _b;
                  }
               });
            }

            for (var i = 0; i < _obj[field].length; ++i) {
               sortArrays(_obj[field][i]);
            }
         }
         else if ((typeof _obj[field] === 'object') && (_obj[field])) {
            sortArrays(_obj[field]);
         }
      }
   }
}
