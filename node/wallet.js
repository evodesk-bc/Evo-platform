const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const assert = require('assert');
const SHA3 = require('keccakjs');

function toBuffer(v) {
  if (!Buffer.isBuffer(v)) {
    if (Array.isArray(v)) {
      v = new Buffer(v);
    } else if (typeof v === 'string') {
      if (isHexPrefixed(v)) {
        v = new Buffer(padToEven(stripHexPrefix(v)), 'hex');
      } else {
        v = new Buffer(v);
      }
    } else if (typeof v === 'number') {
      v = intToBuffer(v);
    } else if (v === null || v === undefined) {
      v = new Buffer([]);
    } else if (v.toArray) {
      // бинарники => буфер
      v = new Buffer(v.toArray());
    } else {
      throw new Error('invalid type');
    }
  }
  return v;
}

function isHexPrefixed(str) {
  return str.slice(0, 2) === '0x';
}

function stripHexPrefix(str) {
  if (typeof str !== 'string') {
    return str;
  }
  return isHexPrefixed(str) ? str.slice(2) : str;
}

function padToEven(a) {
  if (a.length % 2) a = '0' + a;
  return a;
}

function intToBuffer(i) {
  var hex = exports.intToHex(i);
  return new Buffer(hex.slice(2), 'hex');
}

function sha3(a, bytes) {
  a = toBuffer(a);
  if (!bytes) bytes = 256;

  var h = new SHA3(bytes);
  if (a) {
    h.update(a);
  }
  return new Buffer(h.digest('hex'), 'hex');
}

/**
 * @module Wallet
 */

/**
 * Перевод из Int в Hex
 *
 * @param {number} i
 *
 * @returns {string<hex>}
 */
exports.intToHex = function(i) {
  assert(i % 1 === 0, 'number is not a integer');
  assert(i >= 0, 'number must be positive');
  var hex = i.toString(16);
  if (hex.length % 2) {
    hex = '0' + hex;
  }

  return '0x' + hex;
};

/**
 * Перевод публичного ключа в адрес
 *
 * @param {string} pubKey публичный ключ
 * @param {boolean} sanitize
 *
 * @returns {string}
 */
exports.publicToAddress = (pubKey, sanitize) => {
  pubKey = toBuffer(pubKey);
  if (sanitize && pubKey.length !== 64) {
    pubKey = secp256k1.publicKeyConvert(pubKey, false).slice(1);
  }
  assert(pubKey.length === 64);
  // Рекомендуется использовать только хешы меньшие 160 бит
  return sha3(pubKey).slice(-20);
};

/**
 * Генерация данных кошелька
 *
 * @returns {{PrivateKey: string<hex>, PublicKey: string<hex>, Address: string<hex>}}
 */
exports.generate = () => {
  let priv = crypto.randomBytes(32),
    pub = exports.publicToAddress(exports.getPublicFromPrivate(priv));
  return {
    PrivateKey: priv.toString('hex'),
    PublicKey: secp256k1
      .publicKeyCreate(toBuffer(priv), false)
      .slice(1)
      .toString('hex'),
    Address: pub.toString('hex'),
  };
};

/**
 * Перевод приватного ключа в адрес
 *
 * @param {string} priv приватный ключ
 *
 * @returns {string<hex>}
 */
exports.privateToAddress = priv => {
  let address = exports.publicToAddress(exports.getPublicFromPrivate(priv));
  return '0x' + address.toString('hex');
};

/**
 * Получение публичного ключа из приватного
 *
 * @param {string} priv приватный ключ
 *
 * @returns {string} публичный ключ
 */
exports.getPublicFromPrivate = priv => {
  return secp256k1.publicKeyCreate(toBuffer(priv), false).slice(1);
};

/**
 * Проверка правильности адреса
 *
 * @param {string} address
 *
 * @returns {boolean}
 */
exports.isValidAddress = address => {
  if (address[0] == '0' && address[1] == 'x')
    if (address.length == 42) return true;

  return false;
};
