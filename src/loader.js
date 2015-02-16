var S = require('string');

var configFile = (process.argv.length >= 3) ? process.argv[2] : 'casa-collin-config.js'; 
var casaName = (process.argv.length >=4) ? process.argv[3] : 'internet';

console.log('File: ' + configFile + ' - Casa name: casa:' + casaName);
var config = require('./' + configFile);

console.log(config.name);
System = require('./' + S(config.name).between('', ':').s);
System(casaName, config);
