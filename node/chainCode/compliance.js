const Transaction = require('./../transaction');
const Moderator = require('./moderator');
const txDb = require('../db').getInstance('txs');

/**
 * Транзакция 'compliance'.
 * @class
 */
class Compliance extends Transaction {
  /**
   * @constructor
   * @param {string} from Адрес отправителя
   * @param {Object} data Данные транзакции
   * @param {string} signature Подпись транзакции
   */
  constructor(from, data, publicKey, signature, timestamp) {
    super(from, data, publicKey, signature, timestamp);

    this.data.type = 'compliance';
  }

  /**
   * Сохранение транзакций типа 'compliance'
   * @async
   */
  async saveTX() {
    const tx = {
      hash: this.hashTx,
      from: this.from,
      data: {
        type: 'compliance',
        address: this.data.address,
        fullName: this.data.fullName,
      },
      timestamp: this.timestamp,
      publicKey: this.publicKey,
      signature: this.signature,
    };
    this.hash = tx.hash;

    txDb.put(tx.hash, tx);
  }

  /**
   * Проверка валидности транзакции
   */
  async isValidTX() {
    try {
      const moderators = await Moderator.getModeratorsList();
      if (!Moderator.isAlreadyModerator(this.from, moderators)) {
        throw `Only moderators can send compliance transactions!`;
      }

      if (!this.fullNameIsNotEmpty()) {
        throw `Full name is empty!`;
      }

      await Transaction.verifyTX(this);

      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Проверка на заполнение полей
   */
  fullNameIsNotEmpty() {
    return this.data.fullName.replace(/\s/g, '').length > 0;
  }

  /**
   * Пройден ли комплаенс у данного пользователя
   * @param {string} address - адрес проверяемого пользователя
   */
  static async isValidUser(address) {
    let result = false;

    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (
            tx.data.type != 'compliance' ||
            tx.data.address != address ||
            result
          )
            return;

          result = true;
        },
        onEnd: async resolve => {
          resolve(result);
        },
      }
    );
  }
}

module.exports = Compliance;
