'use strict';

const webED = require('./../lib/index');
const bch = new webED('http://localhost:3000');
/*(() => {
    let bch = new webED('http://localhost:8080');

    let wallet = bch.createWallet();
    console.log(wallet);
})();*/

it('создает кошелек', () => {
  let wallet = bch.createWallet();

  if (
    wallet.PrivateKey.length != 66 ||
    wallet.PublicKey.length != 128 ||
    wallet.Address.length != 42
  )
    throw 'все плоха';
  //else
  //console.log(wallet)
});

it('подписывает транзакцию "coin"', async () => {
  let i = 0;
  setTimeout(async function run() {
    if (i < 20) {
      await func();
      setTimeout(run, 1000);
      ++i;
    }
  }, 1000);
  let func = async () => {
    await bch.sendCoin(
      '0xd5d7672e1cc819e4225b917d2b943afe727e3f03',
      10000,
      '0x61a85e134138553b092e639ff49d0790e79360be3935d816e25bf5f6a9fdcc85'
    );
  };
});
