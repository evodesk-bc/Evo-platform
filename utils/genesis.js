require('babel-register')({
  presets: ['env'],
});
const vorpal = require('vorpal')();
const helper = require('../node/helper');
const fs = require('fs');
const Coin = require('../node/chainCode/coin');
const Block = require('./../node/block');
const Wallet = require('./../node/wallet');

const crypto = require('crypto');

vorpal.use(function cli(vorpal) {
  vorpal
    .use(welcome)
    .use(gen)
    .delimiter('Write command →')
    .show();
});

function welcome(vorpal) {
  vorpal.log('Welcome to Evodesk blockchain utility!');
  vorpal.exec('help');
}

function gen(vorpal) {
  vorpal
    .command('gen', 'generate new genesis block')
    .alias('g')
    .option('-p, --privKey', 'Generate with existed private key')
    .action(async function(args, callback) {
      const self = this;

      if (args.options.privKey) {
        return this.prompt(
          [
            {
              type: 'input',
              name: 'privKey',
              message: 'Enter new private key:',
            },
            {
              type: 'input',
              name: 'coinsSupply',
              default: 250000000000,
              message: 'Enter initial coins amount:',
            },
          ],
          async results => {
            self.log(await generate(results.coinsSupply, results.privKey));
          }
        );
      }

      return this.prompt(
        {
          type: 'input',
          name: 'coinsSupply',
          default: 250000000000,
          message: 'Enter initial coins amount:',
        },
        async coinsAmount => {
          const generatedWallet = Wallet.generate();
          self.log(generatedWallet);
          self.log('IMPORTANT!!! SAVE WALLET INFORMATION!!!');

          self.log(
            await generate(coinsAmount.coinsSupply, generatedWallet.PrivateKey)
          );
        }
      );
    });
}

async function generate(amount, privateKey) {
  try {
    if (privateKey.substring(0, 2) != '0x') privateKey = '0x' + privateKey;

    let publicKey = Wallet.getPublicFromPrivate(privateKey);
    const address = '0x' + Wallet.publicToAddress(publicKey).toString('hex');

    publicKey = publicKey.toString('hex');
    let coin = new Coin(
      address,
      {
        type: 'coin',
        inputs: [{ address, amount }],
        outputs: [{ address, amount }],
      },
      publicKey
    );

    await coin.signTX(privateKey);

    let block = {};
    block.index = 0;
    block.previousHash = '0';
    block.timestamp = helper.getTimeInSec();
    block.generator = address;
    block.txs = [coin];
    block.baseTarget = Block.initialBaseTarget;
    block.generationSignature = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex');

    block.cumulativeDifficulty = 0;
    block.publicKey = publicKey;
    block.hash = Block.calculateHash(block);

    const coinObj = {
      blockIndex: 0,
      hash: coin.hash,
      from: coin.from,
      data: {
        type: 'coin',
        comission: 0,
        inputs: coin.data.inputs,
        outputs: coin.data.outputs,
      },
      timestamp: coin.timestamp,
      publicKey: coin.publicKey,
      signature: coin.signature,
    };

    const genesis = JSON.stringify({
      coin,
      block,
    });

    fs.writeFileSync('./genesis.json', genesis);

    return 'Genesis block was generated!';
  } catch (e) {
    console.log(`Can't generate genesis.json\n${e}`);
  }
}
