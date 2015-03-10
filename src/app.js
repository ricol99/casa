var S = require('string');
var crypto = require('crypto');
var fs = require('fs');

var configFile = (process.argv.length >= 3) ? process.argv[2] : 'casa-collin-config.json'; 
var casaName = (process.argv.length >=4) ? process.argv[3] : 'internet';

console.log('File: ' + configFile + ' - Casa name: casa:' + casaName);
var config = require('./' + configFile);

if (casaName == 'internet' && !config.id) {
   config.id = '0000001';
}

if (!config.id) {
   var idFilename = './.' + casaName + 'ID.json';

   try {
      uniqueId = require(idFilename);
      config.id = uniqueId.id;
   }
   catch (ex) {
      // Generate id and write to file
      var id = crypto.randomBytes(16).toString('hex');
      if (err=fs.writeFileSync(idFilename, JSON.stringify({id: id}))) {
         console.log('Cannot write ID file!');
         throw err
      }
      config.id = id;
  }
} 

System = require('./' + S(config.name).between('', ':').s);

var system = new System('casa:' + casaName, config);

