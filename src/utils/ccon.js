var gang = process.argv[2];
var casa = process.argv[3];
var CasaFinder = require('../casafinder');

var casaFinder = new CasaFinder({ gang: gang, casa: casa });
casaFinder.coldStart();

