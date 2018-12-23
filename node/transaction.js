const EC = require('eccrypto');
const EC2 = require('elliptic').ec;
const ec = new EC2('secp256k1');
const crypto = require('crypto');
const txDb = require('./db').getInstance('txs');

const mempool = require('./mempool');

/**
 * Класс транзакции
 * @class
 */
class Transaction {
  /**
   * @constructor
   *
   * @param {string} from адрес отправителя
   * @param {Object} data данные транзакции
   * @param {string} publicKey публичный ключ отправителя
   * @param {string} signature подпись
   */
  constructor(from, data, publicKey, signature, timestamp) {
    this.from = from;
    this.data = data;
    this.publicKey = publicKey;
    this.timestamp = timestamp || Date.now();

    if (signature) {
      this._signature = signature;
    }
  }

  /**
   * Подписание транзакции отправителем
   *
   * @param {string} privateKey - приватный ключ
   *
   * @returns {string<hex>} подпись
   */
  async signTX(privateKey) {
    if (privateKey[0] == '0' && privateKey[1] == 'x') {
      privateKey = Array.from(privateKey);
      privateKey = privateKey.slice(2, privateKey.length);
      privateKey = privateKey.join('');
    }

    privateKey = new Buffer(privateKey, 'hex');

    const str =
      this.from + this.publicKey + this.timestamp + JSON.stringify(this.data);
    const msg = crypto
      .createHash('sha256')
      .update(str)
      .digest();

    this._signature = (await EC.sign(privateKey, msg)).toString('hex');

    this.hash = this.hashTx;

    return this.signature;
  }

  /**
   * Проверка подписи транзакции
   *
   * @param {Transaction} tx - проверяемая транзакция
   */
  static async verifyTX(tx) {
    const str = tx.from + tx.publicKey + tx.timestamp + JSON.stringify(tx.data);
    const msg = crypto
      .createHash('sha256')
      .update(str)
      .digest();
    try {
      await EC.verify(
        new Buffer('04' + tx.publicKey, 'hex'),
        msg,
        new Buffer(tx.signature, 'hex')
      );
    } catch (e) {
      let keyPair = ec.genKeyPair();
      keyPair._importPublic(new Buffer('04' + tx.publicKey, 'hex'), 'hex');

      let pub = keyPair.getPublic(),
        _key = ec.keyFromPublic(pub, 'hex');

      let validSig = _key.verify(new Buffer(msg, 'hex'), tx._signature);

      if (!validSig) {
        throw `Transaction signature is invalid! \n
              ${e}`;
      }
    }
  }

  /**
   * Проверка основных полей транзакции
   */
  checkFields() {
    const generatingHash = this.hashTx;
    if (this.hash != generatingHash) {
      throw `Transaction hash is not equal generating hash! \n
            Hash ${this.hash} != Generating hash ${generatingHash}`;
    }
  }

  /**
   * Проверка валидности транзакции
   * @async
   */
  async isValidTX() {
    try {
      await Transaction.verifyTX(this);
      this.checkFields();

      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Сохранение транзакции в store
   * @async
   */
  saveTX(blockIndex) {
    const tx = {
      blockIndex: blockIndex,
      hash: this.hashTx,
      from: this.from,
      data: {
        type: 'message',
        message: this.data.message,
      },
      timestamp: this.timestamp,
      publicKey: this.publicKey,
      signature: this.signature,
    };
    this.hash = tx.hash;

    txDb.put(tx.hash, tx);
  }

  /**
   * Удаление транзакции из store
   * @async
   *
   * @param {Array<Transaction>} transactions - массив удаляемых транзакций
   */
  static async deleteTransactions(transactions) {
    for (let i = 0; i < transactions.length; i++) {
      txDB.del(transactions[i].hash);

      mempool.addTransaction(transactions[i]);
    }
  }

  static async getTransactions(searchOpts) {
    if (searchOpts.hash) {
      return await txDb.get(searchOpts.hash);
    }

    const resTxs = [];
    return await txDb.createReadStream(
      {
        keys: false,
        values: true,
      },
      {
        onData: tx => {
          if (searchOpts.type && tx.data.type != searchOpts.type) return;
          if (searchOpts.sender && tx.from != searchOpts.sender) return;

          resTxs.push(tx);
        },
        onEnd: resolve => {
          resolve(resTxs);
        },
      }
    );
  }

  /**
   * Получение подписи
   *
   * @type {string}
   */
  get signature() {
    return this._signature;
  }

  /**
   * Получение хэша транзакции
   *
   * @type {strign<hex>}
   */
  get hashTx() {
    return crypto
      .createHash('sha256')
      .update(this.from + this.publicKey + this.timestamp + this.signature)
      .digest('hex');
  }
}

module.exports = Transaction;
