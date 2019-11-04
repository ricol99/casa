var cjson = require('cjson');
var file = process.argv[2];
var LOG = cjson.load(file);

var things = {};
for (var i=0; i < LOG.length-1; i++ ) {

   if (things.hasOwnProperty(LOG[i].uName)) {
     things[LOG[i].uName].props[LOG[i].prop] = LOG[i].value;
      things[LOG[i].uName].timestamp = LOG[i].timestamp;
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
   //for (var thing in things) {
      //console.log(things[thing]);
   //}

   var str = "";

   for (var thing in things) {
      str += things[thing].uName + " ";
   }

   const readline = require('readline');

   var autoComplete = function completer(line) {
      const completions = str.split(' ');
      const hits = completions.filter((c) => c.startsWith(line));

      return [hits.length ? hits : completions, line];
   }


   const rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: autoComplete,
     prompt: 'casa > '
   });

   rl.prompt();

   rl.on('line', (line) => {
     if (line === 'exit' || line ==='quit') {
        process.exit(0);
     }
     console.log(things[line]);
     rl.prompt();
   }).on('close', () => {
     process.exit(0);
   });
}
