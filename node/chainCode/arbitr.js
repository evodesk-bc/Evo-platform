const Transaction = require('./../transaction');
const Moderator = require('./moderator');
const Compliance = require('./compliance');
const Coin = require('./coin');
const Skill = require('./skill');
const txDb = require('../db').getInstance('txs');
const DUTY_PRICE = 200;
const COMMENT_LIMIT = 200;

/**
 * Транзакция 'compliance'.
 * @class
 */
class Arbitr extends Transaction {
  /**
   * @constructor
   * @param {string} from Адрес отправителя
   * @param {Object} data Данные транзакции
   * @param {string} signature Подпись транзакции
   */
  constructor(from, data, publicKey, signature, timestamp) {
    super(from, data, publicKey, signature, timestamp);
    this.data.type = 'arbitr';
  }

  /**
   * Сохранение транзакций типа 'arbitr'
   * если action = 'accept' || 'close', то ref = ссылка на заявку о арбитраже
   * есди action = 'creade', то ref = ссылка на арбитражируемый комментарий
   * @async
   */
  async saveTX() {
    const tx = {
      hash: this.hashTx,
      from: this.from,
      data: {
        type: 'arbitr',
        ref: this.data.ref,
        dutyHash: this.data.dutyHash,
        text: this.data.text,
        action: this.data.action,
        refUser: this.data.refUser,
        refCode: this.data.refCode,
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
      if (this.data.action == 'create') {
        //сущетсвует ли данный комментарий?
        let comment = await Skill.getSkillByHash(this.data.ref);
        if (!comment) throw 'Комментарий не найден';

        this.data.refUser = comment.data.to;
        this.data.refCode = comment.data.code;

        if (comment.data.mark != '-')
          throw 'Нельзя оспаривать положительный отзыв';

        //есть ли комплаенс?
        if (!(await Compliance.isValidUser(this.from)))
          throw `Address ${this.from} doesn't have compliance!`;

        //проверка на повтор
        if (await txDb.get(this.hash)) throw `${this.hash} Is already created`;

        //валидность полей
        this.isValidFields();
      } else if (this.data.action == 'accept' || this.data.action == 'close') {
        const moderators = await Moderator.getModeratorsList();
        if (!Moderator.isAlreadyModerator(this.from, moderators)) {
          throw `Only moderators can send arbitr transactions!`;
        }

        const arbitr = await txDb.get(this.data.ref);
        if (!arbitr)
          throw `Cannot find arbitration transaction with hash ${
            this.data.ref
          }`;

        this.data.refUser = arbitr.data.refUser;
        this.data.refCode = arbitr.data.refCode;
        //согласовывался ли ранее
        if (await Arbitr.checkAlreadyModerated(arbitr))
          throw `Арюитраж по сделке ${this.data.ref} уже проведен`;

        //проверка оплаты пошлины
        if (!(await Arbitr.isDutyPayed(arbitr))) throw `Не оплачина пошлина`;

        //проверка двойной траты
        if (await Arbitr.checkDoubleSpended(arbitr))
          throw `Повторная ссылка на пошлину`;
      } else throw `invalid action`;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Проверка валидности входящих полей
   */
  isValidFields() {
    //валидность хэша
    if (this.data.action == 'create' && this.data.ref.length != 64)
      throw 'Invalid arbitr-tx hash';

    //Проверка комментария
    const filteredText = this.data.text.replace(/\s/g, '');
    if (filteredText.length <= 5) throw 'Message is too short!';

    if (filteredText.length > COMMENT_LIMIT) throw 'Message is too long!';
  }

  /**
   * Проверка на повторное оспаривание
   * @param {string} arbitr - хеш проверяемого спора
   * @async
   */
  static async checkAlreadyModerated(arbitr) {
    let result = false;
    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (
            tx.data.type == 'arbitr' &&
            (tx.data.action == 'accept' || tx.data.action == 'close')
          ) {
            if (tx.data.ref == arbitr.hash) result = true;
          }
        },
        onEnd: async resolve => {
          resolve(result);
        },
      }
    );
  }

  /**
   * Проверка актуальности уплаты пошлины
   * @param {string} arbitr - хеш проверяемого спора
   * @async
   */
  static async checkDoubleSpended(arbitr) {
    let result = true;
    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (
            tx.data.type == 'arbitr' &&
            tx.data.dutyHash == arbitr.data.dutyHash
          ) {
            result = false;
            return;
          }
        },
        onEnd: async resolve => {
          resolve(result);
        },
      }
    );
  }

  /**
   * Проверка уплаты конкретной пошлины
   * @param {string} arbitr - хеш проверяемого спора
   * @async
   */
  static async isDutyPayed(arbitr) {
    let result = false;
    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type == 'coin' && tx.hash == arbitr.data.dutyHash) {
            if (
              tx.data.outputs[0].amount == 200 &&
              tx.data.outputs[0].address == Coin.genesis.from
            )
              result = true;
          }
        },
        onEnd: async resolve => {
          resolve(result);
        },
      }
    );
  }

  /**
   * Получение информации по спору
   * @param {string} hash - hash проверяемого спора
   * @async
   */
  static async getArbitrByHash(hash) {
    let result = { status: 'pending', text: 'moderator not checked' };
    return await txDb.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type == 'arbitr' && tx.data.ref == hash) {
            result = { status: tx.data.action, text: tx.data.text, tx };
          }
        },
        onEnd: async resolve => {
          resolve(result);
        },
      }
    );
  }

  static getDutyPrice() {
    return DUTY_PRICE;
  }
}

module.exports = Arbitr;
