const Transaction = require('./../transaction');
const txDb = require('../db').getInstance('txs');
const fs = require('fs');

const targetProcent = 80; //требуемый процент голосов, чтобы стать модератором

/**
 * Транзакция добавления/удаления модератора.
 * @class
 */
class Moderator extends Transaction {
  /**
   * @constructor
   * @param {string} from Адрес отправителя
   * @param {Object} data Данные транзакции
   * @param {string} signature Подпись транзакции
   */
  constructor(from, data, publicKey, signature, timestamp) {
    super(from, data, publicKey, signature, timestamp);

    this.data.type = 'moderator';
  }

  /**
   * Сохранение транзакций типа 'moderator'
   * @async
   */
  async saveTX() {
    const tx = {
      hash: this.hashTx,
      from: this.from,
      data: {
        type: 'moderator',
        action: this.data.action,
        address: this.data.address,
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

      switch (this.data.action) {
        case 'add':
          if (Moderator.isAlreadyModerator(this.data.address, moderators)) {
            throw `Address ${this.data.address} is already moderator!`;
          }

          if (Moderator.isAlreadyModerator(this.from, moderators)) {
            if (
              !(await Moderator.isAddressHaveEnoughVotes(
                this.data.address,
                moderators
              ))
            ) {
              throw `Address ${
                this.data.address
              } don't have enough votes to be a moderator!`;
            }
          } else if (this.isTXFromAdmin()) {
            //FIXME: В текущей версии запрещено.
          } else {
            throw `Only admin or moderators can send transactions of this type!`;
          }

          break;
        case 'remove':
          if (!this.isTXFromAdmin()) {
            throw `Only admin can send transactions of this type!`;
          }

          break;

        case 'vote':
          if (!Moderator.isAlreadyModerator(this.from, moderators)) {
            throw `Only moderators can send transactions of this type!`;
          }

          break;
      }

      await Transaction.verifyTX(this);

      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Проверка, что транзакция от админа
   *
   * @returns {boolean}
   */
  isTXFromAdmin() {
    const config = JSON.parse(fs.readFileSync('./genesis.json', 'utf8'));

    return (
      this.from == config.coin.from && this.publicKey == config.block.publicKey
    );
  }

  static isAlreadyModerator(address, moderators) {
    return moderators.indexOf(address) != -1;
  }

  /**
   * Проверка, что у адреса достаточно голосов
   *
   * @param {string} address
   *
   * @returns {boolean}
   */
  static async isAddressHaveEnoughVotes(address, moderators) {
    const votesProcent = await Moderator.getVotesCount(address, moderators);

    return votesProcent >= targetProcent;
  }

  /**
   * Возвращает список модераторов
   * @async
   *
   * @returns {Promise<Array>}
   */
  static async getModeratorsList() {
    let addModerators = [],
      removeModerators = [];
    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type != 'moderator') return;

          switch (tx.data.action) {
            case 'add':
              addModerators.push(tx.data.address);

              break;
            case 'remove':
              removeModerators.push(tx.data.address);

              break;
          }
        },
        onEnd: async resolve => {
          removeModerators.forEach(moder => {
            const moderatorIndex = addModerators.indexOf(moder);

            if (moderatorIndex != -1) {
              addModerators.splice(moderatorIndex, 1);
            }
          });
          resolve(addModerators);
        },
      }
    );
  }

  /**
   * Подсчет голосов
   *
   * @param {string} address
   *
   * @returns {Promise<Number>} процент голосов
   */
  static async getVotesCount(address, moderators) {
    let votes = [];
    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type != 'moderator' || tx.data.action != 'vote') return;

          if (tx.data.address == address && votes.indexOf(tx.from) == -1)
            votes.push(tx.from);
        },
        onEnd: async resolve => {
          const votesProcent = (votes.length / moderators.length) * 100;

          resolve(votesProcent);
        },
      }
    );
  }
}

module.exports = Moderator;
