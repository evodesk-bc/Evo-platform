const Mempool = require('./../mempool');
const User = require('./../chainCode/user');
const Peer = require('./Peer');
const PeerList = require('./PeerList');
const publicIp = require('public-ip');
const WebSocket = require('ws');
const messageType = require('./message-type.js'); // Типы сообщений
const {
  RECEIVE_TX,
  REQUEST_LATEST_BLOCK,
  RECEIVE_LATEST_BLOCK,
  REQUEST_BLOCKCHAIN,
  RECEIVE_BLOCKCHAIN,
  REQUEST_HOSTS,
  RECEIVE_HOSTS,
  RECEIVE_REVERSE_CONNECTION,
  REQUEST_REVERSE_CONNECTION,
  REQUEST_MEMPOOL,
  RECEIVE_MEMPOOL,
  RECEIVE_TEXT,
} = messageType;
const peerState = require('./peer-state.js');
const { CONNECTED, DISCONNECTED, BANNED } = peerState;
const Messages = require('./Messages.js'); // Сформированный JSON для всех типов сообщений передаваемых в сети
const PQueue = require('p-queue');
const queue = new PQueue({ concurrency: 1 });

const stunAddr = require('../../config').STUN;

/**
 * Peer-to-peer
 * @class
 */
class P2P {
  /**
   * @constructor
   *
   * @param {Block} blockchain класс функций для работы с блокчейном
   * @param {Status} status класс функций для работы с состоянием
   */
  constructor(blockchain, status) {
    this.stun = {};
    this.peers = [];
    this.blockchain = blockchain;
    this.status = status;
  }

  /**
   * Открыть сокет для входяших сообщений
   * @async
   *
   * @param {number} p2pPort порт
   *
   * @returns {{ip: string, port: number}}
   */
  async startServer(p2pPort) {
    let server_ip = await await publicIp.v4();

    try {
      this.stun.socket = await this.connectToSTUN(stunAddr, 6001);
      this.stun.state = 'connected';
    } catch (err) {
      this.stun.state = 'disconnected';
    }

    const server = new WebSocket.Server({
      port: p2pPort,
      verifyClient: async (info, done) => {
        let incomming = await this.isSocketOpen(
          Peer.normalizeAddress(info.req.connection.remoteAddress)
        );
        console.log(incomming);
        done(!incomming);
      },
    });

    server.on('connection', async ws => {
      const new_peer = Peer.generatePeerByWs(ws);
      if (await this.validatePeer(new_peer.addr)) {
        if (server_ip !== new_peer.addr) {
          await PeerList.setPeer(new_peer.addr, peerState.CONNECTED);
          await this.initConnection.call(this, new_peer);
        } else {
          new_peer.socket.close();
        }
      } else {
        new_peer.socket.close();
      }
    });
    return {
      ip: server_ip,
      port: p2pPort,
      stun: this.stun.state,
    };
  }

  /**
   * Подключиться к STUN серверу
   *
   * @param {string} addr адрес сервера
   * @param {number} port порт сервера
   *
   * @returns {Promise<any>}
   */
  connectToSTUN(addr, port) {
    return new Promise((resolve, reject) => {
      const stun = new WebSocket(`ws://${addr}:${port}`);
      stun.on('open', async () => {
        await this.initSTUNMessageHandler(stun);
        resolve(stun);
      });
      stun.on('error', () => {
        reject();
      });
    });
  }

  /**
   * Обработать входящее сообщение от STUN сервера
   *
   * @param {Object} stun
   */
  async initSTUNMessageHandler(stun) {
    stun.on('message', async message => {
      message = JSON.parse(message.toString('utf8'));
      if (message.type === messageType.RECEIVE_REVERSE_CONNECTION) {
        await this.connectToHost(message.data);
      }
    });
  }

  /**
   * Проверяет, успановлено ли соединение с сококетом
   * @async
   *
   * @param {string} ip
   *
   * @returns {Promise <boolean>}
   */
  async isSocketOpen(ip) {
    return new Promise(async (resolve, reject) => {
      await PeerList.getPeerStateByIp(ip)
        .then(data => {
          resolve(data === peerState.CONNECTED);
        })
        .catch(async () => {
          await PeerList.setPeer(ip, peerState.DISCONNECTED);
          resolve(false);
        });
    });
  }

  /**
   * Присоединиться к пиру по ip
   *
   * @param {string} host ip пира
   *
   * @returns {Promise<any>}
   */
  async connectToHost(host) {
    return new Promise(async (resolve, reject) => {
      const new_peer = Peer.generatePeerByIp(host);

      new_peer.socket.on('open', async () => {
        await PeerList.setPeer(new_peer.addr, peerState.CONNECTED);
        await this.initConnection.call(this, new_peer);
        resolve();
      });

      new_peer.socket.on('error', async () => {
        await PeerList.getPeerStateByIp(new_peer.addr)
          .then(state => {
            if (state === peerState.DISCONNECTED) {
              this.requestReverseConnection(new_peer.addr);
            }
          })
          .catch(async err => {
            await PeerList.setPeer(new_peer.addr, peerState.DISCONNECTED).then(
              () => {
                this.requestReverseConnection(new_peer.addr);
              }
            );
          });
        resolve();
      });
    });
  }

  /**
   * Присоединиться к пирам по ip перечисленным в массиве
   *
   * @param {[string]} host ip пира
   *
   * @returns {void}
   */
  connectToHosts(hosts) {
    hosts.forEach(async host => {
      try {
        await this.connectToHost(host);
      } catch (err) {
        //do nothing
      }
    });
  }

  /**
   * Инициализировать подключенный пир
   *
   * @param {Object} peer
   */
  async initConnection(peer) {
    this.peers.push(peer.socket);
    this.initMessageHandler(peer);
    this.initErrorHandler(peer);
    this.write(peer.socket, Messages.getHosts());
    this.write(peer.socket, Messages.getLatestBlock());
    this.write(peer.socket, Messages.getMempool());
  }

  /**
   * Отправить сообщения всем пирам
   *
   * @param {string} message сообщение для отправки
   */
  sendText(message) {
    this.broadcast(Messages.sendText(message));
  }

  /**
   * Транслирование транзакции
   *
   * @param {Transaction} tx - транзакция
   */
  sendTX(tx) {
    console.log(`отправил транзакцию`);
    this.broadcast(Messages.sendTX(tx));
  }

  /**
   * Транслирование блока
   *
   * @param {Block} block блок для отправки
   */
  sendBlock(block) {
    this.broadcast(Messages.sendLatestBlock(block));
  }

  /**
   * Отправить сообщение всем пирам
   *
   * @param {string} message сообщение
   */
  broadcast(message) {
    this.peers.forEach(peer => {
      this.write(peer, message);
    });
  }

  /**
   * Отправить сообщение
   *
   * @param {WebSocket} ws web socket
   * @param {string} message сообщение
   */
  write(ws, message) {
    ws.send(JSON.stringify(message), err => {
      if (err) console.log(err);
    });
  }

  /**
   * Отправить список подключенных пиров, исключая источник запроса
   *
   * @param {Object} connection
   *
   */
  async sendHosts(connection) {
    let ips = await PeerList.getSendList(connection.addr).catch(err => {
      throw err;
    });

    this.write(connection.socket, Messages.sendHosts(ips));
  }

  /**
   * Инициализировать обработку входящего сообщение
   *
   * @param {Object} connection
   */
  async initMessageHandler(connection) {
    connection.socket.on('message', data => {
      const message = JSON.parse(data.toString('utf8'));
      this.handleMessage(connection, message);
    });
  }

  /**
   * Запросить реверсное подключение
   *
   * @param {string} ip
   */
  requestReverseConnection(ip) {
    if (this.stun.state !== 'disconnected') {
      this.write(this.stun.socket, Messages.getReverseConnection(ip));
    }
  }

  /**
   * Инициализировать обработку входящего сообщения об ошибке
   *
   * @param {Object} connection
   */
  initErrorHandler(connection) {
    const closeConnection = socket => {
      this.peers.splice(this.peers.indexOf(socket), 1);
    };
    connection.socket.on('error', async () => {
      await PeerList.setPeer(connection.addr, peerState.DISCONNECTED);
      closeConnection(connection.socket);
    });
    connection.socket.on('close', async () => {
      await PeerList.setPeer(connection.addr, peerState.DISCONNECTED);
      closeConnection(connection.socket);
    });
  }

  /**
   * Обработать входящее сообщение
   * @async
   *
   * @param {Object} peer
   * @param {string} message
   */
  async handleMessage(peer, message) {
    switch (message.type) {
      case RECEIVE_TX:
        console.log(`получил транзакцию`);
        const self = this;

        queue.add(() => self.handleTX(message));

        break;
      case REQUEST_LATEST_BLOCK:
        console.log(`отправил последний блок`);
        this.write(
          peer.socket,
          Messages.sendLatestBlock(this.blockchain.getLatestBlock())
        );
        break;
      case REQUEST_BLOCKCHAIN:
        console.log(`отправил блокчейн`);
        this.write(
          peer.socket,
          Messages.sendBlockchain(await this.blockchain.getAllBlocks())
        );
        break;
      case REQUEST_MEMPOOL:
        console.log(`отправил мемпул`);
        this.write(peer.socket, Messages.sendMempool(Mempool.getMempool()));
        break;
      case RECEIVE_LATEST_BLOCK:
        console.log(`получил последний блок`);
        this.handleReceivedLatestBlock(message, peer);
        break;
      case RECEIVE_BLOCKCHAIN:
        console.log(`получил блокчейн`);
        this.handleReceivedBlockchain(message, peer);
        break;
      case RECEIVE_MEMPOOL:
        console.log(`получил мемпул`);
        this.handleReceivedMempool(message);
        break;
      case REQUEST_HOSTS:
        console.log(`отправил пиры`);
        this.sendHosts(peer);
        break;
      case RECEIVE_HOSTS:
        console.log(`получил пиры`);
        this.handleReceivedHosts(message);
        break;
      case RECEIVE_TEXT:
        console.log(`получил сообщение`);
        this.handleText(message);
        break;
      default:
        await PeerList.setPeer(peer.addr, peerState.BANNED);
        peer.socket.close();
    }
  }

  /**
   * Обработать входящее текстовое сообщение
   *
   * @param {string} message
   */
  handleText(message) {
    console.log(message.data);
  }

  /**
   * Обработать входящую транзакцию
   *
   * @param {string} message
   */
  handleTX(message) {
    return new Promise(async (resolve, reject) => {
      const incomingTx = message.data;

      if (incomingTx.length) {
        for (let i = 0; i < incomingTx.length; i++) {
          if (Mempool.alreadyInMempool(incomingTx)) resolve();

          await Mempool.addTransaction(incomingTx[i]);

          //this.sendTX(incomingTx[i]);
        }

        resolve();
      } else {
        if (Mempool.alreadyInMempool(incomingTx)) resolve();

        await Mempool.addTransaction(incomingTx);

        //this.sendTX(incomingTx);
        resolve();
      }
    });
  }

  /**
   * Обработать входящий блок
   * @async
   *
   * @param {string} message
   * @param {Object} peer
   */
  async handleReceivedLatestBlock(message, peer) {
    const receivedBlock = message.data;
    const latestBlock = this.blockchain.getLatestBlock();
    if (latestBlock.hash === receivedBlock.previousHash) {
      try {
        let _parseBlock = this.blockchain.parseBlock(receivedBlock);
        await this.blockchain.isValidNextBlock(_parseBlock, latestBlock);
        await this.blockchain.saveBlockTxs(_parseBlock);
        _parseBlock.addBlock();
        User.startMining(null, null, this);
        this.broadcast(
          Messages.sendLatestBlock(this.blockchain.getLatestBlock())
        );
      } catch (err) {
        await PeerList.setPeer(peer.addr, peerState.BANNED);
        peer.socket.close();
        console.log(err);
      }
    } else if (receivedBlock.index >= latestBlock.index) {
      this.write(peer.socket, Messages.getBlockchain());
    } else {
      this.write(
        peer.socket,
        Messages.sendBlockchain(await this.blockchain.getAllBlocks())
      );
    }
  }

  /**
   * Обработать входящий чейн
   * @async
   *
   * @param {string} message
   * @param {Object} peer
   */
  async handleReceivedBlockchain(message, peer) {
    const ownChain = await this.blockchain.getAllBlocks();
    const receivedChain = message.data;
    try {
      await this.compareChains(receivedChain, ownChain, peer);
    } catch (e) {
      console.log(`ERROR handleReceivedBlockchain`);
      console.log(e);
    }
  }

  /**
   * Обработка мемпула
   * @async
   *
   * @param {string} message
   */
  async handleReceivedMempool(message) {
    const receivedMempool = message.data;

    let transaction;
    for (let i = 0; i < receivedMempool.length; i++) {
      transaction = receivedMempool[i];
      if (Mempool.alreadyInMempool(transaction)) continue;

      await Mempool.addTransaction(transaction);

      //this.sendTX(transaction);
    }
  }

  /**
   * Обработать входящй список хостов
   *
   * @param {string} message
   */
  handleReceivedHosts(message) {
    message.data.forEach(async ip => {
      await PeerList.getPeerStateByIp(ip).catch(async err => {
        await PeerList.setPeer(ip, peerState.DISCONNECTED);
        await this.connectToHost(ip);
        //this.broadcast(Messages.sendHosts([ip]));
      });
    });
  }

  /**
   * Проверка, не находится ли пир в бане
   * @async
   *
   * @param {string} ip
   *
   * @returns {Promise<boolean>}
   */
  async validatePeer(ip) {
    return new Promise(async (resolve, reject) => {
      await PeerList.getPeerStateByIp(ip)
        .then(state => {
          resolve(state !== peerState.BANNED);
        })
        .catch(async err => {
          resolve(true);
        });
    });
  }

  /**
   * Заблокировать пир по ip
   * @async
   *
   * @param {string} ip
   *
   * @returns {Promise<void>}
   */
  async banPeerbyIP(ip) {
    await PeerList.setPeer(ip, peerState.BANNED);
  }

  /**
   * Разблокировать всех
   * @async
   *
   * @returns {Promise<void>}
   */
  async unban() {
    await PeerList.changeStateforAll(peerState.BANNED, peerState.DISCONNECTED);
  }

  /**
   * Закрыть все соединения
   */
  disconnect() {
    this.peers.forEach(socket => {
      socket.close();
    });
  }

  /**
   * Функция сравнивающая входящий и хранимый чейн
   * После сравнения решает какой из них сохранить
   * @async
   *
   * @param {Array} receivedChain -- входящий чейн
   * @param {Array} ownChain -- хранимый чейн
   * @param {Object} peer -- пир, с которого пришёл входящий чейн (банится, если один из блоков не прошёл валидцию)
   * @returns {Promise<void>}
   */
  async compareChains(receivedChain, ownChain, peer) {
    try {
      const receivedLatestBlock = receivedChain[receivedChain.length - 1];
      const ownLatestBlock = ownChain[ownChain.length - 1];

      if (receivedLatestBlock.index > ownLatestBlock.index) {
        const targetBlock = receivedChain.find(
          block => block.index === ownLatestBlock.index
        );

        if (targetBlock.hash === ownLatestBlock.hash) {
          const diff = receivedChain.slice(ownLatestBlock.index + 1);

          await this.addBlockDiff(diff, peer);
        } else if (
          targetBlock.cumulativeDifficulty >=
          ownLatestBlock.cumulativeDifficulty
        ) {
          const ownBaseBlocks = ownChain.slice(0, ownLatestBlock.index + 1);
          const receivedBaseBlocks = receivedChain.slice(
            0,
            receivedLatestBlock.index + 1
          );
          let delBuffer = [];

          for (let i = ownBaseBlocks.length - 1; i >= 0; i--) {
            if (ownBaseBlocks[i].hash !== receivedBaseBlocks[i].hash) {
              delBuffer.push(ownBaseBlocks[i].hash);
            } else {
              //TODO: Подправить функцию удаления, что бы корректный последний блок назначлся в ней :)
              await this.blockchain.deleteBlocks(delBuffer);
              this.blockchain.setLastBlock(ownBaseBlocks[i]);
              const diff = receivedChain.slice(ownBaseBlocks[i].index + 1);

              await this.addBlockDiff(diff, peer);
              break;
            }
          }
        }
      } else if (receivedLatestBlock.index === ownLatestBlock.index) {
        if (receivedLatestBlock.hash !== ownLatestBlock.hash) {
          if (
            (receivedLatestBlock.timestamp < ownLatestBlock.timestamp ||
              (receivedLatestBlock.timestamp === ownLatestBlock.timestamp &&
                receivedLatestBlock.hit > ownLatestBlock.hit)) &&
            receivedLatestBlock.cumulativeDifficulty >=
              ownLatestBlock.cumulativeDifficulty
          ) {
            let del_buffer = [];

            for (let i = ownChain.length - 1; i >= 0; i--) {
              if (ownChain[i].hash !== receivedChain[i].hash) {
                del_buffer.push(ownChain[i].hash);
              } else {
                //TODO: Подправить функцию удаления, что бы корректный последний блок назначлся в ней :)
                await this.blockchain.deleteBlocks(del_buffer);
                this.blockchain.setLastBlock(ownChain[i]);
                const diff = receivedChain.slice(ownChain[i].index + 1);

                await this.addBlockDiff(diff, peer);
                break;
              }
            }
          } else {
            this.write(
              peer.socket,
              Messages.sendBlockchain(await this.blockchain.getAllBlocks())
            );
          }
        } else {
          //do nothing
        }
      } else {
        //do nothing
      }
    } catch (e) {
      console.log(`ERROR compareChains`);
      throw e;
    }
  }

  /**
   * Добавляет массив пришедших блоков
   * @async
   *
   * @param {Array} diff
   * @param {Object} peer
   * @returns {Promise<void>}
   */
  async addBlockDiff(diff, peer) {
    try {
      for (let i = 0; i < diff.length; i++) {
        let block = this.blockchain.parseBlock(diff[i]);
        let latestBlock = this.blockchain.getLatestBlock();
        await this.blockchain.isValidNextBlock(block, latestBlock);
        this.blockchain.saveBlockTxs(block);
        block.addBlock();
        User.startMining(null, null, this);
      }
    } catch (err) {
      console.log(`ERROR addBlockDiff`);
      throw err;
    }
  }
}

module.exports = P2P;
