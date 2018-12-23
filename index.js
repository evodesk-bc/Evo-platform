require('babel-register')({
  presets: ['env'],
});
const fs = require('fs');

if (!fs.existsSync('./store')) {
  fs.mkdirSync('./store');
}

try {
  const storeDir = './store';
  const dbDirs = fs.readdirSync(storeDir);
  dbDirs.forEach(dbDir => {
    const pathToLOCK = storeDir + '/' + dbDir + '/' + 'LOCK';
    if (fs.existsSync(pathToLOCK)) {
      fs.writeFile(pathToLOCK, '', function() {});
    }
  });
} catch (e) {
  console.log(e);
}

(async () => await require('./node/block').emptyTest())();
const vorpal = require('vorpal')();
vorpal.use(require('./clients/cli.js'));
