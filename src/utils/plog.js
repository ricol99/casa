var cjson = require('cjson');
var file = process.argv[2];
var LOG = cjson.load(file);

var things = {};
for (var i=0; i < LOG.length-1; i++ ) {

   if (things.hasOwnProperty(LOG[i].uName)) {
     things[LOG[i].uName].props[LOG[i].prop] = LOG[i].value;
   }
   else {
      things[LOG[i].uName] = LOG[i];
      things[LOG[i].uName].props = {};
      things[LOG[i].uName].props[LOG[i].prop] = LOG[i].value;
      delete things[LOG[i].uName].prop;
      delete things[LOG[i].uName].value;
   }
}

if (process.argv.length > 4) {
   console.log(things[process.argv[3]].props[process.argv[4]]);
}
else if (process.argv.length > 3) {
   console.log(things[process.argv[3]]);
}
else {
   for (var thing in things) {
      console.log(things[thing]);
   }
}
