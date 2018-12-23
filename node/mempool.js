const helper = require('./helper');
const perfy = require('perfy');

// const Skill = require('./chainCode/skill');

let transactions = {};
let spentInputs = {};
let unspentInputs = {};

const BLOCK_SIZE = 4000;
/**
 * Функции для работы с Mempool'ом
 * @class
 */
class Mempool {
  constructor() {}

  /**
   * Добавление транзакции
   * @param transaction
   */
  static async addTransaction(transaction, isMy) {
    transaction = helper.fromObjToTx(transaction);
    try {
      let resTime;
      perfy.start('txChecking');
      await Mempool.checkTransaction(transaction, isMy);
      resTime = perfy.end('txChecking').fullMilliseconds;
      console.log('Проверка неподтвержденной транзакции ' + resTime);

      transactions[transaction.hash] = transaction;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Список текущих транзакций в мемпуле.
   * @returns {Array}
   */
  static getMempool() {
    return Object.values(transactions);
  }

  /**
   * Сохранение списка транзакций в мемпуле.
   * @param {Array} txs
   */
  static setMempool(txs) {
    transactions = txs;
  }

  /**
   * Сбор массива транзакций для нового блока
   */
  static getTransactionsForBlock() {
    const transactionsForDelete = Object.values(transactions).splice(
      0,
      BLOCK_SIZE
    );
    Mempool.clearTransactions(transactionsForDelete);

    return transactionsForDelete;
  }

  /**
   * Удаление транзакций из mempool
   * @param transactionsToClear - список удаляемых транзакций
   */
  static async clearTransactions(transactionsToClear) {
    return new Promise((resolve, reject) => {
      transactionsToClear.forEach(tx => {
        Mempool.clearTransaction(tx);
      });

      resolve();
    });
  }

  /**
   * Удаление транзакции из мемпула (с учетом обновления кэша)
   * @param {*} tx
   */
  static async clearTransaction(tx) {
    return new Promise((resolve, reject) => {
      if (tx.data.type == 'coin') {
        tx.data.inputs.forEach(input => {
          delete spentInputs[input.txHash + '_' + input.index];
        });

        tx.data.outputs.forEach((output, index) => {
          if (unspentInputs[output.address]) {
            delete unspentInputs[output.address][tx.hash + '_' + index];

            if (!Object.keys(unspentInputs[output.address]).length) {
              delete unspentInputs[output.address];
            }
          }
        });
      }

      delete transactions[tx.hash];

      resolve();
    });
  }

  /**
   * Фильтр при сквозной синхронизации
   * @param tx - проверяемая транзакция
   */
  static async checkTransaction(tx, isMy) {
    if (!isMy) {
      //TODO: Проверка на двойную трату
      await tx.isValidTX();
    }

    if (transactions[tx.hash]) {
      throw `Transaction with hash ${tx.hash} already in mempool!`;
    }

    if (tx.data.type != 'coin') return;

    tx.data.inputs.forEach(input => {
      if (spentInputs[input.txHash + '_' + input.index]) {
        throw `Input from ${
          input.txHash
        } is already used in mempool transaction`;
      }

      spentInputs[input.txHash + '_' + input.index] = {
        txHash: input.txHash,
        index: input.index,
      };
    });

    tx.data.outputs.forEach((output, index) => {
      if (!unspentInputs[output.address]) {
        unspentInputs[output.address] = {};
      }

      unspentInputs[output.address][tx.hash + '_' + index] = {
        txHash: tx.hash,
        index,
        amount: output.amount,
      };
    });
  }

  static isInputUsed(input) {
    return spentInputs[input.txHash + '_' + input.index];
  }

  static getUnspentMempoolInputs(address) {
    if (unspentInputs[address] == undefined) return [];
    return Object.values(unspentInputs[address]);
  }

  static deleteUnspentMempoolInputs(address, uInputs) {
    return new Promise((resolve, reject) => {
      uInputs.forEach(uInput => {
        delete unspentInputs[address][uInput.txHash + '_' + uInput.index];
      });

      resolve();
    });
  }

  static alreadyInMempool(transaction) {
    return transactions[transaction.hash];
  }

  static TxLength() {
    return Object.keys(transactions).length;
  }
}

module.exports = Mempool;
