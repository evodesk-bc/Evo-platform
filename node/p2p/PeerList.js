const PeerDb = require('../db').getInstance('peers');
/**
 * Класс, описывающий взаимодействие со списком пиров из базы данных
 * @class
 */
class PeerList {
  /**
   * Возвращает список пиров, хранимых в БД
   * @async
   *
   * @returns {Promise<Array>}
   */
  static async getPeers() {
    let peers = [];

    return await PeerDb.createReadStream(
      {},
      {
        onData: data => {
          peers.push(data);
        },
        onEnd: resolve => {
          resolve(peers);
        },
      }
    );
  }
  /**
   * Возвращает список пиров, которые необходимо отправить другой ноде
   * @async
   *
   * @param {string} to -- адрес ноды, куда отправляется список
   *
   * @returns {Promise<Array>}
   */

  static async getSendList(to) {
    let list = [];

    return await PeerDb.createReadStream(
      {},
      {
        onData: data => {
          if (data.key !== to) {
            list.push(data.key);
          }
        },
        onEnd: resolve => {
          resolve(list);
        },
      }
    );
  }

  /**
   * Возвращает состояние соединения пира
   * @async
   *
   * @param {string} ip -- адрес пира
   *
   * @returns {Promise<number>}
   */
  static async getPeerStateByIp(ip) {
    return await PeerDb.createReadStream(
      {},
      {
        onData: (data, resolve) => {
          if (data.key === ip) {
            resolve(data.value);
          }
        },
        onEnd: (resolve, reject) => {
          reject('Peer not found!');
        },
      }
    );
  }

  /**
   * Добавляет пир в список или Обновляет его состояние
   * @async
   *
   * @param {string} addr -- ip
   * @param {string} state -- состояние подключения
   *
   * @returns {Promise<void>}
   */
  static async setPeer(addr, state) {
    await PeerDb.put(addr, state);
  }

  /**
   * Разблокировать все пиры
   * @async
   *
   * @param {Object} current
   * @param {Object} target
   *
   * @returns {Promise<void>}
   */
  static async changeStateforAll(current, target) {
    await PeerDb.createReadStream(
      {},
      {
        onData: data => {
          if (data.value === current) {
            this.setPeer(data.key, target);
          }
        },

        onEnd: resolve => {
          resolve();
        },
      }
    );
  }
}

module.exports = PeerList;
