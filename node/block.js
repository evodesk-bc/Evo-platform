const crypto = require('crypto');
const fs = require('fs');
const helper = require('./helper');
const Mempool = require('./mempool');
const Skill = require('./chainCode/skill');
const Transaction = require('./transaction');
const Coin = require('./chainCode/coin');

const blockDb = require('./db').getInstance('blocks');
const txDb = require('./db').getInstance('txs');
const blockHashesDb = require('./db').getInstance('blocksHashes');

let lastBlock = null;

const perfy = require('perfy');

/**
 * @class
 */
class Block {
  /**
   * @constructor
   *
   * @param {number} index номер блока
   * @param {string} previousHash хэш предыдущего
   * @param {number} timestamp время создания
   * @param {Array<Transaction>} txs транзакции
   * @param {number} baseTarget
   * @param {string} miner
   * @param {string} genSig generation signature
   * @param {number} cumulativeDifficulty сложность блока
   * @param {string} publicKey публичный ключ
   * @param {string} hash хэш блока
   */
  constructor(
    index,
    previousHash,
    timestamp,
    txs,
    baseTarget,
    miner,
    genSig,
    cumulativeDifficulty,
    publicKey,
    hash
  ) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.txs = txs;
    this.hash = hash;
    this.baseTarget = baseTarget; //int
    this.generationSignature = genSig; //bytesString
    this.cumulativeDifficulty = cumulativeDifficulty; //int
    this.generator = miner;
    this.publicKey = publicKey;
  }

  /**
   * Создание генезисного блока по заданной конфигурации
   *
   * @type {Block}
   */
  static get genesis() {
    let config;
    try {
      config = JSON.parse(fs.readFileSync('./genesis.json', 'utf8'));
      config = config.block;
    } catch (e) {
      console.log("Can't open genesis.json!");
    }

    const genesisBlock = new Block(
      config.index,
      config.previousHash,
      config.timestamp,
      config.txs,
      config.baseTarget,
      config.generator,
      config.generationSignature,
      config.cumulativeDifficulty,
      config.publicKey,
      config.hash
    );

    return genesisBlock;
  }

  /**
   * Генерация нового блока
   *
   * @param {Array<Transaction>} txs - массив транзакций блока
   * @param {number} baseTarget
   * @param {string} miner - адрес кошелька майнера
   * @param {string} genSig
   * @param {string} publicKey - публичный ключ майнера
   *
   * @returns {Block}
   */
  static generateNextBlock(txs, baseTarget, miner, genSig, publicKey) {
    const latestBlock = Block.getLatestBlock();
    const nextIndex = latestBlock.index + 1;
    const previousHash = latestBlock.hash;
    let timestamp = helper.getTimeInSec();

    let nextBlock = new Block(
      nextIndex,
      previousHash,
      timestamp,
      txs,
      baseTarget,
      miner,
      genSig,
      Math.floor(
        latestBlock.cumulativeDifficulty + 18446744073709551616 / baseTarget
      ), //2^64/baseTarget,
      publicKey
    );

    nextBlock.hash = this.calculateHash(nextBlock);

    return nextBlock;
  }

  /**
   * Сохранение блока в store
   * @async
   */
  async addBlock() {
    try {
      blockDb.put(this.hash, this);
      blockHashesDb.put(Block.prepearIndex(this.index), this.hash);

      Block.setLastBlock(this);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   * Десериализация сообщения типа 'блок' от узла
   * @async
   *
   * @param {Object} block - сериализованный блок
   *
   * @returns {Promies<Block>}
   */
  static parseBlock(block) {
    return new Block(
      block.index,
      block.previousHash,
      block.timestamp,
      block.txs,
      block.baseTarget,
      block.generator,
      block.generationSignature,
      block.cumulativeDifficulty,
      block.publicKey,
      block.hash
    );
  }

  static async saveBlockTxs(block) {
    const txs = block.txs;
    let resTime;
    perfy.start('txsAdding');

    txs.forEach(async tx => {
      let newTx = helper.fromObjToTx(tx);

      if (!Mempool.alreadyInMempool(newTx)) await newTx.isValidTX(block.index);

      newTx.saveTX(block.index);
    });

    setImmediate(Mempool.clearTransactions, block.txs);
    resTime = perfy.end('txsAdding').fullMilliseconds;
    console.log('Добавление транзаций в бд(с валидацией) ' + resTime);

    return block;
  }

  /**
   * Удаление блоков по хэшу
   * @async
   *
   * @param {Array<string>} blockHashes - массив хэшей удаляемых блоков
   */
  static async deleteBlocks(blockHashes) {
    for (let i = 0; i < blockHashes.length; i++) {
      const block = await blockDb.get(blockHashes[i]);

      blockHashesDb.del(Block.prepearIndex(block.index));
      blockDb.del(blockHashes[i]);

      await Transaction.deleteTransactions(block.txs);
    }
  }

  static getHit(genSig) {
    return parseInt(genSig.substr(0, 12), 16);
  }

  /**
   * Генерация 'target' для конкретного майнера
   * @param address - адрес майнера
   * @param latestBlock - последний блок (подтвержденный)
   * @return {{target: Number, timestamp: Number}}
   */
  static async getTarget(address, latestBlock) {
    const prevTarget = latestBlock.baseTarget;
    const lastBlockTime = latestBlock.timestamp;

    //will be replace to "importnant kf"
    const skillCoins = await Skill.translateSkillsInCoins(address);
    const balance = (await Coin.getBalance(address)) + skillCoins;
    console.log('SkillCoins: ' + skillCoins + ' Balance: ' + balance);
    console.log('prevBaseTarget: ' + prevTarget);
    const target = Number(prevTarget) * Number(balance);

    return target;
  }

  /**
   * Подсчет хэша блока
   *
   * @param {Block} block - хэшируемый блок
   *
   * @returns {string} хэш блока
   */
  static calculateHash(block) {
    return crypto
      .createHash('sha256')
      .update(
        block.index +
          block.previousHash +
          block.timestamp +
          block.baseTarget +
          block.generationSignature +
          block.cumulativeDifficulty +
          block.generator
      )
      .digest('hex');
  }

  /**
   * Проверка 'Generation signature' блока
   */
  async verifyGenerationSignature() {
    const lastBlock = Block.getLatestBlock();

    const genSig = crypto
      .createHash('sha256')
      .update(lastBlock.generationSignature + this.publicKey)
      .digest('hex');

    if (genSig != this.generationSignature) {
      throw `Invalid generation signature! 
            Right gen sig(${genSig}) != New block gen sig(${
        this.generationSignature
      })`;
    }

    const hit = parseInt(genSig.substr(0, 12), 16);
    perfy.start('getBalance');
    const skillCoins = await Skill.translateSkillsInCoins(this.generator);
    const balance = (await Coin.getBalance(this.generator)) + skillCoins;
    let resTime = perfy.end('getBalance').fullMilliseconds;
    console.log('Получение баланса при проверке gen sig' + resTime);
    const timestamp = Number(this.timestamp);
    const target =
      Number(lastBlock.baseTarget) *
      (timestamp - Number(lastBlock.timestamp)) *
      balance;

    if (target <= hit) {
      throw `Target less than or equal hit!
            Target(${target}) <= Hit(${hit})`;
    }
  }

  /**
   * Проверка валидности блока
   * @async
   *
   * @param {Block} nextBlock - новый блок
   * @param {Block} previousBlock - текущий блок
   */
  static async isValidNextBlock(nextBlock, previousBlock) {
    if (previousBlock.index + 1 !== nextBlock.index) {
      throw `Next block index is invalid!
            Previous index(${previousBlock.index}) + 1 != Next block index(${
        nextBlock.index
      })`;
    }

    const calculatedHash = Block.calculateHash(nextBlock);
    if (calculatedHash != nextBlock.hash) {
      throw `Calculated block hash and hash in block are not equal!
            Calculated hash(${calculatedHash}) != Block hash(${
        nextBlock.hash
      })`;
    }

    if (previousBlock.hash !== nextBlock.previousHash) {
      throw `Previous hash of next block is not equal hash of previous block!
            Previous hash(${previousBlock.hash}) != Next block previous hash(${
        nextBlock.previousHash
      })`;
    }

    const curTime = helper.getTimeInSec();
    if (nextBlock.timestamp > curTime + 5) {
      throw `Block from the future? Or maybe your current time is invalid
            Next block timestamp(${
              nextBlock.timestamp
            }) > Your current time(${curTime})`;
    }

    if (nextBlock.timestamp < previousBlock.timestamp) {
      throw `Next block timestamp less than previous block timestamp!
            Next block timestamp(${
              nextBlock.timestamp
            }) < Previous block timestamp(${previousBlock.timestamp})`;
    }

    let resTime;
    perfy.start('genSigVerif');
    await nextBlock.verifyGenerationSignature();
    resTime = perfy.end('genSigVerif').fullMilliseconds;
    console.log('Проверка generation signature ' + resTime);
  }

  /**
   * Обновление последнего блока в памяти процесса
   *
   * @param {Block} block
   */
  static setLastBlock(block) {
    lastBlock = block;
  }

  /**
   * Получение последнего блока из памяти процесса
   *
   * @returns {Block}
   */
  static getLatestBlock() {
    return lastBlock;
  }

  /**
   * Получение блока по его хэшу
   * @async
   *
   * @param {string} hash - хэш запрашиваемого блока
   *
   * @returns {Block}
   */
  static async getBlockByHash(hash) {
    const block = await blockDb.get(hash);

    return block;
  }

  /**
   * Получение блока по хэшу транзакции, содержащейся в нем
   * @async
   *
   * @param {string} txHash - хэш транзакции
   *
   * @returns {Promise<Block>}
   */
  static async getBlockByTxHash(txHash) {
    return blockDb.createReadStream(
      {},
      {
        onData: block => {
          const blockData = block.value;
          const blockTxs = blockData.txs;

          blockTxs.forEach(async tx => {
            if (tx.hash == txHash) {
              resolve(block);
            }
          });
        },
        onEnd: async resolve => {
          resolve('Block not found!');
        },
      }
    );
  }

  /**
   * Список все доступных блоков
   * @async
   *
   * @returns {Promise<Array<Block>>}
   */
  static async getAllBlocks() {
    let blocks = [];

    return await blockDb.createReadStream(
      {
        keys: false,
        value: true,
      },
      {
        onData: data => {
          blocks.push(data);
        },
        onEnd: resolve => {
          blocks = blocks.sort((a, b) => {
            return +a.index - +b.index;
          });

          resolve(blocks);
        },
      }
    );
  }

  /**
   * Проверка на наличие генезисного блока в структуре блокчейна
   * @async
   */
  static async emptyTest() {
    let isNotEmpty = await helper.isDBNotEmpty(blockHashesDb);

    if (!isNotEmpty) {
      blockDb.put(Block.genesis.hash, Block.genesis);
      blockHashesDb.put(
        Block.prepearIndex(Block.genesis.index),
        Block.genesis.hash
      );
      txDb.put(Block.genesis.txs[0], Coin.genesis);

      Block.setLastBlock(Block.genesis);
    } else {
      const lastBlockFromDB = await blockDb.get(isNotEmpty);
      Block.setLastBlock(lastBlockFromDB);
    }
  }

  /**
   * Подготовка индекса к хранению в levelDB (добавление префиксных нулей)
   *
   * @param {number} index - обрабатываемый индекс
   *
   * @returns {string}
   */
  static prepearIndex(index) {
    index = Array.from(index.toString());
    while (index.length < 12) {
      index.unshift('0');
    }
    index = index.join('');
    return index.toString();
  }

  /**
   * Удаление формальных перфиксов из индекса
   *
   * @param {number} index - обрабатываемый индекс
   *
   * @returns {string}
   */
  static clearIndex(index) {
    index = Array.from(index.toString());
    while (index[index.length - 1] > 1 || index[0] != '0') {
      index = index.splice(0, 1);
    }
    return index.join('');
  }

  /**
   * Создание 'Generation signature' по публичному ключу
   *
   * @param {string} pub - публичный ключ
   *
   * @returns {string}
   */
  static getGenSignature(pub) {
    let latestBlock = Block.getLatestBlock();

    return crypto
      .createHash('sha256')
      .update(latestBlock.generationSignature + pub)
      .digest('hex');
  }

  /**
   * Начальное значение base target
   *
   * @type {number}
   */
  static get initialBaseTarget() {
    return 153722867;
  }

  /**
   * Начальное количество монет
   *
   * @type {number}
   */
  static get initialCoinAmount() {
    return Coin.getTotalSupply();
  }

  /**
   * Максимальное значение base target
   *
   * @type {number}
   */
  static get maxBaseTarget() {
    return Block.initialCoinAmount * Block.initialBaseTarget;
  }
}

module.exports = Block;

exports.getLatestBlock = () => {
  return lastBlock;
};
