var S = require('string');

var configFile = (process.argv.length >= 3) ? process.argv[2] : 'casa-collin-config.json'; 
var casaName = (process.argv.length >=4) ? process.argv[3] : 'casa:internet';

console.log('File: ' + configFile + ' - Casa name: ' + casaName);
var config = require('./' + configFile);

System = require('./' + S(config.name).between('', ':').s);
var system = new System(casaName, config);

