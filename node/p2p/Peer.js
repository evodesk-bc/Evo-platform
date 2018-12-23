const WebSocket = require('ws');

/**
 * @class
 */
class Peer {
  /**
   * Добавляет пир по ip
   *
   * @param {string} ip
   *
   * @returns {Object}
   */
  static generatePeerByIp(ip) {
    const _addr = Peer.normalizeAddress(ip);
    return {
      addr: _addr,
      socket: new WebSocket(`ws://${_addr}:6000`),
    };
  }

  /**
   * Добавляет пир по ws
   *
   * @param {WebSocket} ws
   *
   * @returns {Object}
   */
  static generatePeerByWs(ws) {
    return {
      addr: this.normalizeAddress(ws._socket.remoteAddress),
      socket: ws,
    };
  }

  /**
   * Нормализует ipv4 адрес
   *
   * @param {string} ip
   *
   * @returns {string} ip
   */
  static normalizeAddress(ip) {
    if (ip.substr(0, 7) === '::ffff:') {
      ip = ip.substr(7);
    }
    return ip;
  }
}

module.exports = Peer;
