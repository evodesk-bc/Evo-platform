const crypto = require('crypto');
const fs = require('fs');

const Transaction = require('./transaction');
const Coin = require('./chainCode/coin');
const Skill = require('./chainCode/skill');
const Moderator = require('./chainCode/moderator');
const Compliance = require('./chainCode/compliance');
const Block = require('./block');
const Arbitr = require('./chainCode/arbitr');

/**
 * @module Helper
 */

/**
 * Проверка на пустоту заданного хранилища
 *
 * @param {string} db - путь к БД
 *
 * @returns {Promise<bool>}
 */
exports.isDBNotEmpty = async db => {
  let empty = false;

  return await db.createReadStream(
    {
      keys: true,
      values: true,
      limit: 1,
      reverse: true,
    },
    {
      onData: data => {
        empty = data.value;
      },
      onEnd: resolve => {
        resolve(empty);
      },
    }
  );
};

/**
 * Генерация соли заданного размера
 *
 * @param {number} length - число знаков соли
 *
 * @returns {String<hex>}
 */
exports.genRandomString = length => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

/**
 * Перевод timestamp в секунды
 *
 * @returns {number}
 */
exports.getTimeInSec = () => {
  let ms = new Date();
  return Math.floor(ms / 1000);
};

/**
 * Распаковка Object => Transaction_type
 *
 * @param {Object} obj - распаковываемый объект
 *
 * @returns {Transaction}
 */
exports.fromObjToTx = obj => {
  if (!(obj instanceof Transaction)) {
    const hash = obj.hash;
    switch (obj.data.type) {
      case 'coin':
        obj = new Coin(
          obj.from,
          obj.data,
          obj.publicKey,
          obj._signature,
          obj.timestamp
        );
        break;
      case 'message':
        obj = new Transaction(
          obj.from,
          obj.data,
          obj.publicKey,
          obj._signature,
          obj.timestamp
        );
        break;
      case 'skill':
        obj = new Skill(
          obj.from,
          obj.data,
          obj.publicKey,
          obj._signature,
          obj.timestamp
        );
        break;
      case 'moderator':
        obj = new Moderator(
          obj.from,
          obj.data,
          obj.publicKey,
          obj._signature,
          obj.timestamp
        );
        break;
      case 'compliance':
        obj = new Compliance(
          obj.from,
          obj.data,
          obj.publicKey,
          obj._signature,
          obj.timestamp
        );
        break;
      case 'arbitr':
        obj = new Arbitr(
          obj.from,
          obj.data,
          obj.publicKey,
          obj._signature,
          obj.timestamp
        );
        break;
    }

    obj.hash = hash;
  }

  return obj;
};
