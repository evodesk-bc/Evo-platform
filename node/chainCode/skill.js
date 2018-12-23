import Transaction from '../transaction';
import Block from '../block';
import Compliance from './compliance';
import Coin from './coin';
import types from './skill-type';

const txDB = require('./../db').getInstance('txs');

const BLOCK_LIMIT = 10;
const COMMENT_LIMIT = 100;

const PERCENT_OFFSET = 0.0005; //процент от общей капитализации evocoin, для перевода компетенций в коины
const SKILL_DECREASING_VALUE = 0.1; //шаг распада компетенции
const SKILL_DECREASING_PERIOD = 604800000; //интервал уменьшения значения компетенции на SKILL_DECREASING_VALUE. Неделя - 604800000ms

/**
 * Класс для работы с компетенциями и комментариями к ним
 * @class
 */
class Skill extends Transaction {
  /**
   *
   * @param {String} from
   * @param {Object} data
   * @param {Hex} signature
   */
  constructor(from, data, publicKey, signature, timestamp) {
    super(from, data, publicKey, signature, timestamp);
    this.data.type = 'skill';
    this.blockIndex;
  }

  /**
   * Преобработка входящих данных
   * @param {string} to - кому
   * @param {string} mark - оценка + или -
   * @param {string} text - комментарий
   * @param {number} code - код компетенции
   */
  async prepareTX(to, mark, text, code) {
    try {
      text = text
        .replace('/', '')
        .replace('<', '')
        .replace('>', '');
      this.data.mark = mark;
      this.data.text = text;
      this.data.code = code;
      this.data.to = to;
    } catch (e) {
      throw e;
    }
  }

  /**
   * Проверка владиности транзакции
   */
  async isValidTX() {
    try {
      //есть ли комплаенс?
      if (!(await Compliance.isValidUser(this.from))) {
        throw `Address ${this.from} doesn't have compliance!`;
      }

      const senderSkills = await Skill.getAllSkills(this.from);

      //проверка отзывы на валидность
      this.isValidFields();

      //если сам себе
      if (this.data.to == this.from) {
        //проверка, не отправлял ли раньше
        if (await Skill.hasThisSkill(this.data.code, senderSkills.skillsByCode))
          throw 'This competence you already have!';
      }
      //если другому
      else {
        const recepientSkills = await Skill.getAllSkills(this.data.to);

        //проверка что прошло N блоков с момента отправки
        this.checkBlockPermission(senderSkills.lastBlockIndex);
        //проверка на наличие данной компетенции
        if (
          !(await Skill.hasThisSkill(
            this.data.code,
            recepientSkills.skillsByCode
          ))
        )
          throw `Address ${this.data.to} doesn't have this competence!`;
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Проверка на частоту добавление компетенций
   * @param {number} lastSkillBlockIndex
   */
  checkBlockPermission(lastSkillBlockIndex) {
    const latestBlockIndex = Block.getLatestBlock().index;
    if (
      latestBlockIndex >= BLOCK_LIMIT &&
      latestBlockIndex - lastSkillBlockIndex < BLOCK_LIMIT
    )
      throw 'Stop spaming!';
  }

  /**
   * Валидация входящих полей
   */
  isValidFields() {
    //Проверка поля mark
    if (this.data.mark != '+' && this.data.mark != '-') {
      throw `Field mark can be only '+' or '-'!`;
    }

    //Проверка кода компетенции
    types.isCodeValid(this.data.code);

    //Проверка комментария
    const filteredText = this.data.text.replace(/\s/g, '');
    if (filteredText.length <= 5) throw 'Message is too short!';

    if (filteredText.length > COMMENT_LIMIT) throw 'Message is too long!';
  }

  /**
   * Проверка на наличие данного скилла у пользователя
   * @param {number} skillCode - искомый скилл
   * @param {Array} skillsByCode - список всех скиллов пользователя
   */
  static async hasThisSkill(skillCode, skillsByCode) {
    return skillsByCode.indexOf(skillCode) != -1;
  }

  /**
   *
   * @param {*} address
   * @async @returns {{skills, skillsByCode, lastBlockIndex, average}} - названия и коды скиллов, актуальный индек блока, индекс компетентности
   */
  static async getAllSkills(address) {
    let skillsObj = {};
    let skillsByCode = [];
    let lastBlockIndex = 0;
    let average = 0;

    return txDB.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          let skillName;
          switch (tx.data.type) {
            case 'skill':
              if (
                tx.from == address &&
                tx.data.to != address &&
                tx.blockIndex > lastBlockIndex
              ) {
                lastBlockIndex = tx.blockIndex;
              }

              if (tx.data.to != address) return;

              skillName = types.skillsValue(tx.data.code);
              if (skillsObj[skillName] == undefined) {
                skillsObj[skillName] = {
                  marks: 0,
                  minTimestamp: tx.timestamp,
                };
                skillsByCode.push(tx.data.code);
              }

              switch (tx.data.mark) {
                case '+':
                  skillsObj[skillName].marks += 1;

                  break;

                case '-':
                  skillsObj[skillName].marks -= 1;

                  break;
              }

              if (tx.timestamp < skillsObj[skillName].minTimestamp) {
                skillsObj[skillName].minTimestamp = tx.timestamp;
              }
              break;

            case 'arbitr':
              if (tx.data.action != 'accept' || tx.data.refUser != address)
                break;

              skillName = types.skillsValue(tx.data.refCode);
              if (skillsObj[skillName] == undefined) {
                skillsObj[skillName] = {
                  marks: 0,
                  minTimestamp: tx.timestamp,
                };
                skillsByCode.push(tx.data.refCode);
              }

              skillsObj[skillName].marks += 1;

              break;
          }
        },
        onEnd: resolve => {
          let skillsArr = [];
          const currTimestamp = Date.now();

          for (let skill in skillsObj) {
            let newSkillMark =
              skillsObj[skill].marks -
              Math.trunc(
                (currTimestamp - skillsObj[skill].minTimestamp) /
                  SKILL_DECREASING_PERIOD
              ) *
                SKILL_DECREASING_VALUE;
            newSkillMark = Math.min(Math.max(newSkillMark, 0), 10);

            average += newSkillMark;

            skillsArr.push({
              name: skill,
              mark: newSkillMark,
            });
          }

          if (skillsArr.length != 0) average /= skillsArr.length;

          resolve({
            skills: skillsArr,
            skillsByCode,
            lastBlockIndex,
            average,
          });
        },
      }
    );
  }

  /**
   * Получение всех комментариев в конкретному скиллу, конкретного пользователя
   * @param {string} address
   * @param {string} code
   * @async
   */
  static async getComments(address, code) {
    let comments = [];

    return await txDB.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type != 'skill' || tx.data.to != address) return;

          if (code && tx.data.code != code) return;

          comments.push(tx);
        },
        onEnd: resolve => {
          resolve(comments);
        },
      }
    );
  }

  /**
   * Рассчет вирутальные монет, на основе индекса компетентностей для State.
   * @param {string} address
   */
  static async translateSkillsInCoins(address) {
    const skillsAverage = (await Skill.getAllSkills(address)).average;

    return (Coin.getTotalSupply() * PERCENT_OFFSET * skillsAverage) / 100;
  }

  /**
   * Информация о комментарии к компетентности по хешу
   * @param {string} hash
   */
  static async getSkillByHash(hash) {
    let result = false;
    return await txDB.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type == 'skill' && tx.hash == hash) {
            result = tx;
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
   * Адрес отправителя комментария к компетенции по хешу
   * @param {string} hash
   */
  static async getAddresByHash(hash) {
    let result = false;
    return await txDB.createReadStream(
      {},
      {
        onData: tx => {
          tx = tx.value;

          if (tx.data.type == 'skill' && tx.hash == hash) {
            result = tx.from;
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
   * Сохранение транзакций типа 'skill'
   * @async
   */
  async saveTX(blockIndex) {
    const tx = {
      blockIndex: Number(blockIndex),
      hash: this.hashTx,
      from: this.from,
      data: {
        type: this.data.type,
        mark: this.data.mark,
        text: this.data.text,
        code: this.data.code,
        to: this.data.to,
      },
      timestamp: this.timestamp,
      publicKey: this.publicKey,
      signature: this.signature,
    };
    this.hash = tx.hash;

    await txDB.put(tx.hash, tx);
  }
}

module.exports = Skill;
