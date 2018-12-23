import User from '../node/chainCode/user';
import Transaction from '../node/transaction';
import Coin from '../node/chainCode/coin';
import Skill from '../node/chainCode/skill';
import P2P from '../node/p2p/p2p';
import Wallet from './../node/wallet';
import Block from './../node/block';
import Mempool from './../node/mempool';
import Status from './../node/status';
import PeerList from './../node/p2p/PeerList';
import Moderator from './../node/chainCode/moderator';
import { initConnection } from '../config';
import Compliance from './../node/chainCode/compliance';
import Arbitr from './../node/chainCode/arbitr';
import { hosts } from '../config';

const express = require('express');
const status = new Status();
const p2p = new P2P(Block, status);

exports.createWallet = password => {
  return User.newWallet(password);
};

exports.listWallets = async () => {
  const wallets = await User.listWallets();

  let walletsStr = '';
  wallets.forEach((wallet, i) => {
    walletsStr += `${i + 1}. Address: 0x${wallet.address}. File name: ${
      wallet.fileName
    }. \n`;
  });

  return {
    str: walletsStr,
    list: wallets,
  };
};

exports.getChoiceWalletList = async () => {
  const walletList = await User.listWallets();
  let choiceList = [];

  walletList.forEach((wallet, i) => {
    choiceList.push({
      name: `${i + 1}. Address: 0x${wallet.address}.`,
      value: wallet.fileName,
    });
  });

  return choiceList;
};

exports.setDefaultWallet = (walletFile, password) => {
  const privateKey = User.readKeystore(walletFile, password);

  User.setDefaultWallet(privateKey);

  return Wallet.privateToAddress(privateKey) + ' set as default';
};

exports.startHTTP = port => {
  const app = express();

  app.use('/', require('./rpc/rpc'));

  app.listen(port);
};

exports.startP2P = async port => {
  return await p2p.startServer(port);
};

exports.connect = async host => {
  await p2p.connectToHost(host);
};

exports.connectToAll = async () => {
  let hosts = await PeerList.getPeers();
  let ips = [];
  hosts.forEach(host => {
    ips.push(host.key);
  });

  if (ips.length === 0) {
    p2p.connectToHosts(initConnection);
  }
  p2p.connectToHosts(ips);
};

exports.startMining = async (wallet, pass) => {
  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  const address = Wallet.privateToAddress(privateKey);
  const pub = Wallet.getPublicFromPrivate(privateKey).toString('hex');

  await User.enableMining(address, pub, p2p);

  return 'start mining';
};

exports._startMining = async () => {
  let pub = Wallet.getPublicFromPrivate(
    '0x61a85e134138553b092e639ff49d0790e79360be3935d816e25bf5f6a9fdcc85'
  ).toString('hex');

  await User.startMining(
    '0x4b5aeb308b066a889da78139118d574ca6817315',
    pub,
    p2p
  );
};

exports.getAllBlocks = async args => {
  switch (args) {
    case 'quantity':
      const latestBlock = Block.getLatestBlock();

      if (latestBlock) {
        return latestBlock.index + 1;
      }

      return 0;

      break;
    default:
      return await Block.getAllBlocks();
  }
};

exports.getPeers = async () => {
  return await PeerList.getPeers();
};

exports.search = async (args, data) => {
  switch (args) {
    case 'a': 
      break;
    case 't':
      try {
        const block = await Block.getBlockByTxHash(data);

        return block;
      } catch (err) {
        return err;
      }

      break;
    case 'b':
      try {
        const block = await Block.getBlockByHash(data);

        return block;
      } catch (err) {
        return 'Block not found!';
      }

      break;
  }
};

exports.addHost = host => {};

exports.removeHost = host => {};

exports.getHosts = host => {};

exports.resetHosts = () => {};

exports.getStatus = () => {
  return 'Current status: ' + status.state;
};

exports.sendTestCoin = async (amount, to, privateKey) => {
  let tx = new Coin(
    Wallet.privateToAddress(privateKey),
    {},
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.prepareTX(to, amount);
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx, true);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.prepareCoin = async (from, to, amount) => {
  let tx = new Coin(from, {});
  await tx.prepareTX(to, amount);
  return tx;
};

exports.sendCoin = async (
  amount,
  to,
  walletFile,
  password,
  notSendAfterGen
) => {
  if (!Wallet.isValidAddress(to)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Coin(
    Wallet.privateToAddress(privateKey),
    {},
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.prepareTX(to, amount);
    await tx.signTX(privateKey);

    if (!notSendAfterGen) {
      await Mempool.addTransaction(tx, true);
      p2p.sendTX(tx);

      return tx.hashTx;
    }

    return tx;
  } catch (err) {
    throw err;
  }
};

exports.getDutyPrice = () => {
  return Arbitr.getDutyPrice();
};

exports.genesis = () => {
  return Block.genesis.generator;
};

exports.sendArbitr = async (ref, text, _action, walletFile, password) => {
  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let coinTx, dutyHash;
  if (_action == 'create') {
    coinTx = await exports.sendCoin(
      Arbitr.getDutyPrice(),
      Coin.genesis.from,
      null,
      null,
      true
    );
    dutyHash = coinTx.hash;
  } else dutyHash = '';

  let tx = new Arbitr(
    Wallet.privateToAddress(privateKey),
    {
      ref,
      dutyHash,
      text,
      action: _action,
    },
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);
    p2p.sendTX(tx);

    if (_action == 'create') {
      await Mempool.addTransaction(coinTx);
      p2p.sendTX(coinTx);
    }
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.getArbitr = async (ref, walletFile, password) => {
  return await Arbitr.getArbitrByHash(ref);
};

exports.sendComment = async (mark, text, code, to, walletFile, password) => {
  if (!Wallet.isValidAddress(to)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Skill(
    Wallet.privateToAddress(privateKey),
    {},
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.prepareTX(to, mark, text, code);
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.sendTx = async (message, to, walletFile, password) => {
  if (!Wallet.isValidAddress(to)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Transaction(
    Wallet.privateToAddress(privateKey),
    {
      type: 'message',
      message: message,
    },
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.sendText = message => {
  p2p.sendText(message);
};

exports.sendSignedTx = tx => {
  p2p.sendTX(tx);
};

exports.getBalance = async address => {
  return await Coin.getBalance(address);
};

exports.banIP = async ip => {
  await p2p.banPeerbyIP(ip);
};

exports.unbanAll = async () => {
  await p2p.unban();
};

exports.disconnect = () => {
  p2p.disconnect();
};

exports.test = () => {
  console.log(p2p.blockchain.latestBlock);
};

exports.sendBrokenMsg = () => {
  const msg = {
    type: 10,
    data: 'this msg is invalid',
  };
  p2p.broadcast(msg);
};

exports.createKeystore = (pk, password) => {
  const address = Wallet.privateToAddress(pk);
  const fileName = User.createKeystore(
    address.substring(2),
    pk.substring(2),
    password
  );

  User.setDefaultWallet(pk);
  return `Address: ${address}, \nFile name: ${fileName}`;
};

exports.testMempool = async () => {
  console.log(await Mempool.getTarget(), await Mempool.getHit());
};

exports.getMempool = () => {
  return Mempool.getMempool();
};

exports.setMempool = txs => {
  Mempool.setMempool(txs);
  p2p.sendTX(txs);
};

exports.clearMempool = () => {
  Mempool.clearTransactions(Mempool.getMempool());
};

exports.stopMining = () => {
  User.stopMining();
};

exports.addModerator = async (address, walletFile, password) => {
  if (!Wallet.isValidAddress(address)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Moderator(
    Wallet.privateToAddress(privateKey),
    {
      type: 'moderator',
      action: 'add',
      address: address,
    },
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.removeModerator = async (address, walletFile, password) => {
  if (!Wallet.isValidAddress(address)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Moderator(
    Wallet.privateToAddress(privateKey),
    {
      type: 'moderator',
      action: 'remove',
      address: address,
    },
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.getModeratorsList = async () => {
  return await Moderator.getModeratorsList();
};

exports.voteForModerator = async (address, walletFile, password) => {
  if (!Wallet.isValidAddress(address)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Moderator(
    Wallet.privateToAddress(privateKey),
    {
      type: 'moderator',
      action: 'vote',
      address: address,
    },
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.getVotesCount = async address => {
  const moderators = await Moderator.getModeratorsList();

  return await Moderator.getVotesCount(address, moderators);
};

exports.sendCompliance = async (address, fullName, walletFile, password) => {
  if (!Wallet.isValidAddress(address)) throw 'invalid address';

  let privateKey;
  if (User.isDefaultWalletSet()) {
    privateKey = User.getDefaultWallet().privateKey;
  } else {
    privateKey = User.readKeystore(walletFile, password);
  }

  let tx = new Compliance(
    Wallet.privateToAddress(privateKey),
    {
      type: 'compliance',
      address,
      fullName,
    },
    Wallet.getPublicFromPrivate(privateKey).toString('hex')
  );
  try {
    await tx.signTX(privateKey);

    await Mempool.addTransaction(tx);

    p2p.sendTX(tx);
  } catch (err) {
    throw err;
  }

  return 'success: ' + tx.hashTx;
};

exports.isAddressHaveCompliance = async address => {
  return Compliance.isValidUser(address);
};

exports.getAllUserSkills = async address => {
  return (await Skill.getAllSkills(address)).skills;
};

exports.getComments = async (address, code) => {
  code = code == 'all' ? null : code;

  return await Skill.getComments(address, code);
};

exports.getTransactions = async searchOpts => {
  return await Transaction.getTransactions(searchOpts);
};
