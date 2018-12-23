import wallet from '../wallet';
import helper from '../helper';
import crypto from 'crypto';
import scrypt from 'scryptsy';
import aes from 'aes-js';
import fs from 'fs';
import Mempool from '../mempool';
import Block from '../block';
import Status from './../status';

const perfy = require('perfy');

let mining, miningTimerId, minerAddress, minerPubKey;
let privKey;

/**
 * Пользователь
 * @class
 */
class User {
  constructor() {
    this.pair;
  }

  /**
   * Создание keystore
   * @param {string} address - адрес кошелька
   * @param {string} pk - приватный ключ кошелька
   * @param {string} password - пароль к keystore кошелька
   *
   * @returns {string} Имя keystore файла
   */
  static createKeystore(address, pk, password) {
    const salt = helper.genRandomString(64);
    const key = scrypt(password, salt, 262144, 1, 8, 32);

    const textBytes = aes.utils.utf8.toBytes(pk);

    const iv = crypto.randomBytes(16);
    const aesCtr = new aes.ModeOfOperation.ctr(key, iv);

    const encryptedBytes = aesCtr.encrypt(textBytes);
    const encryptedHex = aes.utils.hex.fromBytes(encryptedBytes);

    const mac = crypto
      .createHash('sha256')
      .update(encryptedHex + key)
      .digest('hex');

    const keystore = {
      address,
      ciphertext: encryptedHex,
      iv: iv.toString('hex'),
      kdfparams: {
        n: 262144,
        r: 1,
        p: 8,
        salt,
        dklen: 32,
      },
      mac,
    };

    if (!fs.existsSync('./keystore')) {
      fs.mkdirSync('./keystore');
    }

    const date = Date.now();
    fs.writeFileSync(
      `./keystore/${date}.json`,
      JSON.stringify(keystore, null, 4)
    );

    return date + '.json';
  }

  /**
   * Получение приватного ключа по keystore и паролю
   * @param {string} walletFile - путь к keystore файлу
   * @param {string} password - пароль
   *
   * @returns {string} - приватный ключ кошелька
   */
  static readKeystore(walletFile, password) {
    const keystore = JSON.parse(fs.readFileSync('./keystore/' + walletFile));
    const kdfparams = keystore.kdfparams;

    const key = scrypt(
      password,
      kdfparams.salt,
      kdfparams.n,
      kdfparams.r,
      kdfparams.p,
      kdfparams.dklen
    );

    const mac = crypto
      .createHash('sha256')
      .update(keystore.ciphertext + key)
      .digest('hex');
    if (mac != keystore.mac) throw 'Invalid key';

    const encryptedBytes = aes.utils.hex.toBytes(keystore.ciphertext);

    const iv = new Buffer(keystore.iv, 'hex');
    const aesCtr = new aes.ModeOfOperation.ctr(key, iv);

    const decryptedBytes = aesCtr.decrypt(encryptedBytes);
    const decryptedText = aes.utils.utf8.fromBytes(decryptedBytes);

    User.setDefaultWallet(decryptedText);

    return '0x' + decryptedText;
  }

  /**
   * Список доступных кошельков
   *
   * @returns {Promise<Array>}
   */
  static listWallets() {
    if (!fs.existsSync('./keystore')) {
      throw 'No wallets!';
    }

    return new Promise((resolve, reject) => {
      fs.readdir('./keystore', (err, files) => {
        let wallets = [];
        files.forEach(file => {
          const keystore = JSON.parse(fs.readFileSync('./keystore/' + file));
          wallets.push({
            fileName: file,
            address: keystore.address,
          });
        });

        if (!wallets.length) {
          reject('No wallets!');
        }

        resolve(wallets);
      });
    });
  }

  /**
   * Создание нового кошелька
   * @param {string} password пароль для keystore
   *
   * @returns {{private: string, address: string}}
   */
  static newWallet(password) {
    this.pair = wallet.generate();

    User.createKeystore(this.pair.Address, this.pair.PrivateKey, password);

    User.setDefaultWallet('0x' + this.pair.PrivateKey);

    return {
      private: `0x${this.pair.PrivateKey}`,
      address: `0x${this.pair.Address}`,
    };
  }

  /**
   * Выбор кошелька по умолчанию
   * @param {string} privateKey приватный ключ
   */
  static setDefaultWallet(privateKey) {
    privKey = privateKey;
  }

  /**
   * Проверка на наличие кошелька по умолчанию
   *
   * @returns {boolean}
   */
  static isDefaultWalletSet() {
    return !!privKey;
  }

  /**
   * Получение кошелька по умолчанию
   *
   * @returns {{address: string, privateKey: string}}
   */
  static getDefaultWallet() {
    return {
      address: wallet.privateToAddress(privKey),
      privateKey: privKey,
    };
  }

  static enableMining(address, pub, p2p) {
    mining = true;

    User.startMining(address, pub, p2p);
  }
  /**
   * Запуск майнинга. Майнинг возможен на любом кошельке, чей публичный ключ Вы знаете.
   * @async
   * @param {string} address - адрес майнера
   * @param {string} pub - публичный ключ майнера
   * @param {string} p2p - объект класса P2P
   */
  static async startMining(address, pub, p2p) {
    if (!mining) return;

    if (miningTimerId) {
      clearTimeout(miningTimerId);
      miningTimerId = null;
    }

    address = address || minerAddress;
    pub = pub || minerPubKey;

    minerAddress = address;
    minerPubKey = minerPubKey;

    const latestBlock = Block.getLatestBlock();
    const targetPerSec = await Block.getTarget(address, latestBlock);
    if (targetPerSec <= 0) {
      console.log(`You can't mine with zero balance!`);

      User.stopMining();

      return;
    }

    const timestamp = helper.getTimeInSec();
    const currTarget = targetPerSec * (timestamp - latestBlock.timestamp);
    console.log('target: ' + currTarget);
    const genSig = Block.getGenSignature(pub);
    const hit = Block.getHit(genSig);
    console.log('hit' + hit);

    const genTime =
      currTarget < hit ? ((hit - currTarget) / targetPerSec) * 1000 + 1000 : 0; //Время для майнинга в мс
    console.log('Блок замайнится через ' + genTime);

    miningTimerId = setTimeout(async () => {
      let timeRes;
      perfy.start('blockGen');

      const transactions = Mempool.getTransactionsForBlock();
      console.log('Насобирали ' + transactions.length + ' транзакций');

      const newTimestamp = helper.getTimeInSec();
      let maxTarget = Math.min(2 * latestBlock.baseTarget, Block.maxBaseTarget),
        minTarget = Math.max(Math.floor(latestBlock.baseTarget / 2), 1),
        delta = newTimestamp - latestBlock.timestamp,
        candidate = Math.floor((latestBlock.baseTarget * delta) / 20),
        baseTarget = Math.min(Math.max(minTarget, candidate), maxTarget);

      let block = Block.generateNextBlock(
        transactions,
        baseTarget,
        address,
        genSig,
        pub
      );

      await Block.isValidNextBlock(block, latestBlock);

      perfy.start('txSaving');

      let average = 0;
      for (let i = 0; i < transactions.length; i++) {
        perfy.start('oneTxSaving');
        transactions[i].saveTX(Block.getLatestBlock().index + 1);
        average += perfy.end('oneTxSaving').fullMilliseconds;
      }
      timeRes = perfy.end('txSaving').fullMilliseconds;
      console.log(
        'Транзакции сохранены ' +
          timeRes +
          '. Среднее время сохранения 1 транзакции ' +
          average / transactions.length +
          'нс'
      );

      perfy.start('savingBlock');
      block.addBlock();
      timeRes = perfy.end('savingBlock').fullMilliseconds;
      console.log('Блок сохранен ' + timeRes + 'нс');

      p2p.sendBlock(block);

      timeRes = perfy.end('blockGen').fullMilliseconds;
      console.log('Блок замайнен ' + timeRes + 'нс');
      console.log(`mined ${block.hash}`);

      setTimeout(() => {
        User.startMining(address, pub, p2p);
      }, 1000);
    }, genTime);
  }

  /**
   * Остановка майнинга
   */
  static stopMining() {
    clearTimeout(miningTimerId);

    mining = false;
  }
}

module.exports = User;
