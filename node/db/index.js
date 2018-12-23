const level = require('level');
const Jobs = require('level-jobs');

const fs = require('fs');
if (!fs.existsSync('./store')) {
  fs.mkdirSync('./store');
}

let dbs = {};
function worker(id, payload, cb) {
  const dbName = payload.dbName;
  const self = dbs[dbName];
  switch (payload.task) {
    case 'put':
      self.putTask(payload.key, payload.value).then(() => {
        cb();
      });

      break;
    case 'get':
      self
        .getTask(payload.key)
        .then(data => {
          cb();
          self._cbFunc(data);
        })
        .catch(err => {
          self._errFunc(err);
        });

      break;
    case 'del':
      self.delTask(payload.key).then(() => {
        cb();
      });

      break;
    case 'createReadStream':
      self.getCreateReadStream(
        payload.options,
        self._stream,
        self._cbFunc,
        self._errFunc,
        cb
      );

      break;
  }
}

let singletonEnforcer = Symbol();
class DB {
  constructor(enforcer, dbName) {
    if (enforcer !== singletonEnforcer)
      throw 'Instantiation failed: use Singleton.getInstance() instead of new.';
    //Инициализация в зависимости от имени бд
    this._db = level(`./store/${dbName}`, { valueEncoding: 'json' });

    this._jobsDb = level(`./store/${dbName}Jobs`);

    this.dbName = dbName;
    this._cbFunc, this._stream, this._errFunc;

    this._jobs = Jobs(this._jobsDb, worker);
    dbs[dbName] = this;
  }

  createReadStream(options, functions) {
    return new Promise((resolve, reject) => {
      const work = {
        task: 'createReadStream',
        options,
        dbName: this.dbName,
      };

      this._stream = functions;
      this._cbFunc = resolve;
      this._errFunc = reject;

      this._jobs.push(work, err => {});
    });
  }

  put(key, value) {
    const work = {
      task: 'put',
      key,
      value,
      dbName: this.dbName,
    };

    this._jobs.push(work, err => {});
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      const work = {
        task: 'get',
        key,
        dbName: this.dbName,
      };

      this._cbFunc = resolve;
      this._errFunc = reject;

      this._jobs.push(work, err => {});
    });
  }

  del(key) {
    const work = {
      task: 'del',
      key,
      dbName: this.dbName,
    };

    this._jobs.push(work, err => {});
  }

  async getTask(key) {
    return await this._db.get(key);
  }

  async putTask(key, value) {
    await this._db.put(key, value);
  }

  async delTask(key) {
    await this._db.del(key);
  }

  async getCreateReadStream(options, funcs, resolve, reject, cb) {
    this._db
      .createReadStream(options)
      .on('data', async data => {
        await funcs.onData(data, resolve, reject);
      })
      .on('end', async () => {
        if (funcs.onEnd != undefined) await funcs.onEnd(resolve, reject);

        cb();
      });
  }

  static getInstance(dbName) {
    if (!this[dbName]) {
      this[dbName] = new DB(singletonEnforcer, dbName);
    }
    return this[dbName];
  }
}

module.exports = DB;
