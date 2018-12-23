import level from 'level';
import Transaction from './../transaction';
import helper from './../helper';
import fs from 'fs';
import wallet from './../wallet';
import { calcTax } from './tax-type';
import { getLatestBlock } from '../block';
import {
  isInputUsed,
  getUnspentMempoolInputs,
  deleteUnspentMempoolInputs,
} from '../mempool';

const CacheBase = require('cache-base');
const cachedBalances = new CacheBase();
const txDb = require('./../db').getInstance('txs');

let totalSupply = 0;

/**
 * Транзакции типа "coin"
 * @class
 */
class Coin extends Transaction {
  /**
   * @constructor
   * @param {string} from Адрес отправителя
   * @param {Object} data Данные транзакции
   * @param {string} publicKey публичный ключ отправителя
   * @param {string} signature Подпись транзакии
   */
  constructor(from, data, publicKey, signature, timestamp) {
    super(from, data, publicKey, signature, timestamp);
    this.data.type = 'coin';
    this.data.comission = this.data.comission || 0;
  }

  /**
   * Формирование inputs и outputs для конкретной транзакции
   * @async
   * @param {string} to - адрес получателя
   * @param {number} amount - число evocoin'ов
   */
  async prepareTX(to, amount) {
    try {
      const unspentInputs = await Coin.getUnspentInputs(this.from);
      const { inputs, remainder } = await this.pickInputs(
        amount,
        unspentInputs
      );

      this.data.inputs = inputs;

      //расcчет комиссии
      if (to != Coin.genesis.from) {
        let balance = await Coin.getBalance(to, null);
        this.data.comission = calcTax(balance);
      }

      //получателю
      this.data.outputs = [
        {
          address: to,
          amount: amount - Math.ceil(amount * this.data.comission),
        },
      ];

      //сдача
      if (remainder > 0) {
        this.data.outputs.push({
          address: this.from,
          amount: remainder,
        });
      }

      this.hash = this.hashTx;
      //оплата комиссии
      if (to != Coin.genesis.from)
        this.data.outputs.push({
          address: Coin.genesis.from,
          amount: Math.ceil(amount * this.data.comission),
        });
    } catch (err) {
      throw err;
    }
  }

  /**
   * Сохранение транзакций типа 'coin'
   * @async
   */
  async saveTX(blockIndex) {
    const self = this;
    return new Promise((resolve, reject) => {
      const tx = {
        blockIndex: Number(blockIndex),
        hash: self.hashTx,
        from: self.from,
        data: {
          type: 'coin',
          comission: self.data.comission,
          inputs: self.data.inputs,
          outputs: self.data.outputs,
        },
        timestamp: self.timestamp,
        publicKey: self.publicKey,
        signature: self.signature,
      };
      self.hash = tx.hash;

      txDb.put(tx.hash, tx);

      self.recomputeBalance();
    });
  }

  /**
   * Кэширование данных по балансу отправителя
   */
  recomputeBalance() {
    return new Promise((resolve, reject) => {
      if (cachedBalances.has(this.from)) {
        cachedBalances.set(
          this.from,
          cachedBalances.get(this.from) - this.inputTotal
        );
      }

      this.data.outputs.forEach(output => {
        if (cachedBalances.has(output.address)) {
          cachedBalances.set(
            output.address,
            cachedBalances.get(output.address) + output.amount
          );
        }
      });

      resolve();
    });
  }

  /**
   * Сбор входящих транзакций на конкретную сумму
   *
   * @param {number} amount - сумма evocoin'ов
   * @returns {{inputs: Array, remainder: Number}}
   */
  async pickInputs(amount, unspentInputs) {
    let takenInputs = [],
      deposit = 0,
      uMempoolInputs = getUnspentMempoolInputs(this.from),
      takenUMempoolInputs = [];

    for (
      let i = 0, j = 0;
      (j < uMempoolInputs.length || i < unspentInputs.length) &&
      deposit < Number(amount);
      i++
    ) {
      if (unspentInputs[i] && !isInputUsed(unspentInputs[i])) {
        takenInputs.push(unspentInputs[i]);
        deposit += Number(unspentInputs[i].amount);

        continue;
      }

      if (j >= uMempoolInputs.length) {
        throw `Attempt to double waste!`;
      }
      takenInputs.push(uMempoolInputs[j]);
      takenUMempoolInputs.push(uMempoolInputs[j]);

      deposit += uMempoolInputs[j++].amount;
    }

    const remainder = deposit - Number(amount);
    if (remainder < 0) {
      throw 'Insufficient balance!';
    }

    //Удаляем неипользованные инпуты, которые использовали, из мемпула
    if (takenUMempoolInputs.length > 0)
      await deleteUnspentMempoolInputs(this.from, takenUMempoolInputs);

    return {
      inputs: takenInputs,
      remainder: remainder,
    };
  }

  /**
   * Проверка на соответствие входящих и исходящих транзакций
   */
  isInputsMoreThanOutputs() {
    if (this.inputTotal < this.outputTotal) {
      throw 'Inputs must be greater than or equal to outputs!';
    }
  }

  /**
   * Все входящие транзакции
   * @type {Array}
   */
  get inputTotal() {
    return this.data.inputs.reduce(
      (total, input) => total + Number(input.amount),
      0
    );
  }

  /**
   * Все исходящие транзакции
   * @type {Array}
   */
  get outputTotal() {
    return this.data.outputs.reduce(
      (total, output) => total + Number(output.amount),
      0
    );
  }

  /**
   * Общее число evocoin'ов в системе
   * @returns {number}
   */
  static getTotalSupply() {
    if (totalSupply == 0) {
      let config = JSON.parse(fs.readFileSync('./genesis.json', 'utf8'));
      totalSupply = config.coin.data.inputs[0].amount;
    }
    return totalSupply;
  }

  /**
   * Проверка на двойную трату
   *
   * @returns {boolean}
   */
  async checkDoubleWaste() {
    const unspentInputs = await Coin.getUnspentInputs(this.from, null, true);

    this.data.inputs.forEach(input => {
      if (unspentInputs[input.txHash + '_' + input.index] != null) return;

      throw `Attempt to double waste!`;
    });
  }

  /**
   * Проверка на соотвествие правилу 'налог на сверх богатых'
   */
  async isTaxed(blockIndex) {
    let recipientAddress = null;
    let balance;
    for (let i = 0; i < this.data.outputs.length; i++) {
      if (
        this.data.outputs[i].address != Coin.genesis.from &&
        this.data.outputs[i].address != this.from
      ) {
        recipientAddress = this.data.outputs[i].address;
        balance = await Coin.getBalance(recipientAddress, blockIndex);

        break;
      }
    }

    if (recipientAddress == null) return;

    if (this.data.outputs.length > 3) {
      throw 'Invalid tx struct!';
    }

    const tax = calcTax(balance);

    if (tax != this.data.comission) throw 'Invalid tax!';

    if (this.data.comission != 0) {
      let recipientAmount, genesisAmount, txAmount;
      for (let i = 0; i < this.data.outputs.length; i++) {
        if (this.data.outputs[i].address == recipientAddress)
          recipientAmount = this.data.outputs[i].amount;
        if (this.data.outputs[i].address == Coin.genesis.from)
          genesisAmount = this.data.outputs[i].amount;
      }

      txAmount = recipientAmount + genesisAmount;
      if (Math.ceil(txAmount * tax) != genesisAmount)
        throw 'Invalid tax output!';
    }
  }

  /**
   * Проверка валидности транзакции
   * @async
   */
  async isValidTX(blockIndex) {
    try {
      let resTime;
      await Transaction.verifyTX(this);

      this.checkFields();
      this.isInputsMoreThanOutputs();

      await this.isTaxed(getLatestBlock().index - 1);

      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Формирование транзакции типа 'coin' из генезисного блока
   * @type {Coin}
   */
  static get genesis() {
    let config = JSON.parse(fs.readFileSync('./genesis.json', 'utf8'));
    config = config.coin;
    totalSupply = config.data.outputs[0].amount;

    let coin = new Coin(
      config.from,
      {
        type: 'coin',
        inputs: [{ address: config.from, amount: totalSupply }],
        outputs: [{ address: config.from, amount: totalSupply }],
      },
      config.publicKey,
      config.signature,
      config.timestamp
    );
    coin.blockIndex = 0;
    coin.data.comission = 0;

    return coin;
  }

  /**
   * Список всех транзакций отправителя
   * @param {string} address - адрес отправителя
   * @returns {Promise<Object>}
   */
  static getUnspentInputs(address, asObj) {
    let spentInputs = {},
      unspentInputs = {};

    return txDb.createReadStream(
      {},
      {
        onData: tx => {
          try {
            if (tx.value.data.type != 'coin') return;

            const txHash = tx.key;
            const transaction = tx.value;

            transaction.data.outputs.forEach((output, index) => {
              if (
                output.address == address &&
                spentInputs[txHash + '_' + index] == undefined
              ) {
                unspentInputs[txHash + '_' + index] = {
                  blockIndex: transaction.blockIndex,
                  txHash: txHash,
                  index: index,
                  amount: output.amount,
                };
              }
            });

            if (transaction.from != address) return;

            transaction.data.inputs.forEach((input, index) => {
              spentInputs[input.txHash + '_' + input.index] = {
                txHash: input.txHash,
                index: input.index,
                amount: input.amount,
              };
              if (unspentInputs[input.txHash + '_' + input.index] == undefined)
                return;

              delete unspentInputs[input.txHash + '_' + input.index];
            });
          } catch (e) {}
        },
        onEnd: resolve => {
          if (asObj) {
            resolve(unspentInputs);
          } else {
            resolve(Object.values(unspentInputs));
          }
        },
      }
    );
  }

  /**
   * Получение баланса evocoin'ов
   * @async
   * @param {string} address - проверяемый адрес
   * @returns {number} Баланс кошелька
   */
  static async getBalance(address, blockLimit, unspentInputs) {
    if (!wallet.isValidAddress(address)) return 'invalid address';

    //Возврат из кэша
    if (!blockLimit && cachedBalances.has(address)) {
      return cachedBalances.get(address);
    }

    if (unspentInputs == undefined) {
      unspentInputs = await Coin.getUnspentInputs(address);
    }

    let balance = 0,
      limitBalance = 0;

    unspentInputs.map(uotputs => {
      if (uotputs.blockIndex < blockLimit) {
        limitBalance += Number(uotputs.amount);
      }
      balance = Number(balance) + Number(uotputs.amount);
    });

    cachedBalances.set(address, balance);

    if (!blockLimit) return balance;
    else return limitBalance;
  }
}

module.exports = Coin;
