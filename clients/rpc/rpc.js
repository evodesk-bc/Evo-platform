require('babel-register')({
  presets: ['env'],
});

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const blockHashesDb = require('../../node/db').getInstance('blocksHashes');
const blockDb = require('../../node/db').getInstance('blocks');
const transactionDb = require('../../node/db').getInstance('txs');
const Block = require('../../node/block');
const Mempool = require('../../node/mempool');
const helper = require('../../node/helper');
const actions = require('../actions');

const app = express();

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/blockhashes', async (req, res) => {
  let blockHashes = [];
  try {
    const response = await blockHashesDb.createReadStream(
      {},
      {
        onData: data => {
          blockHashes.push({
            index: parseInt(data.key, 10),
            hash: data.value,
          });
        },
        onEnd: resolve => {
          resolve(blockHashes);
        },
      }
    );
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post('/blockhashes', async (req, res) => {
  let blockHashes = [];
  let i = 0;
  try {
    const limit = {
      start: parseInt(req.body.start, 10),
      end: parseInt(req.body.end, 10),
    };
    const response = await blockHashesDb.createReadStream(
      {},
      {
        onData: (data, resolve) => {
          if (i === limit.end + 1) {
            resolve(blockHashes);
          } else {
            if (i >= limit.start) {
              blockHashes.push({
                index: parseInt(data.key, 10),
                hash: data.value,
              });
            }
            i++;
          }
        },
        onEnd: resolve => {
          resolve(blockHashes);
        },
      }
    );
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/transactions', async (req, res) => {
  try {
    const response = await actions.getTransactions({});
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post('/transactions', async (req, res) => {
  let transactions = [];
  let i = 0;
  try {
    const limit = {
      start: parseInt(req.body.start, 10),
      end: parseInt(req.body.end, 10),
    };
    const response = await transactionDb.createReadStream(
      {},
      {
        onData: (data, resolve) => {
          if (i === limit.end + 1) {
            resolve(transactions);
          } else {
            if (i >= limit.start) {
              transactions.push(data);
            }
            i++;
          }
        },
        onEnd: resolve => {
          resolve(transactions);
        },
      }
    );
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/blocks', async (req, res) => {
  try {
    const response = await actions.getAllBlocks();
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post('/blocks', async (req, res) => {
  let blocks = [];
  let i = 0;
  try {
    const limit = {
      start: parseInt(req.body.start, 10),
      end: parseInt(req.body.end, 10),
    };
    const response = await blockDb.createReadStream(
      { keys: false, values: true },
      {
        onData: (data, resolve) => {
          if (i === limit.end + 1) {
            resolve(blocks);
          } else {
            if (i >= limit.start) {
              blocks.push(data);
            }
            i++;
          }
        },
        onEnd: resolve => {
          resolve(blocks);
        },
      }
    );
    res.send(response);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/blockhashes/:index', async (req, res) => {
  let key = Block.prepearIndex(req.params.index);
  try {
    let data = await blockHashesDb.get(key);
    res.send(data);
  } catch (e) {
    res.status(404).send(e);
  }
});

app.get('/blocks/:hash', async (req, res) => {
  try {
    let data = await blockDb.get(req.params.hash);
    res.send(data);
  } catch (e) {
    res.status(404).send(e);
  }
});

app.get('/transactions/:hash', async (req, res) => {
  try {
    let data = await transactionDb.get(req.params.hash);
    res.send(data);
  } catch (e) {
    console.log(e);
    res.status(404).send(e);
  }
});

app.get('/mempool', (req, res) => {
  try {
    res.send(Mempool.getMempool());
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post('/sendtx', async (req, res) => {
  try {
    const tx = helper.fromObjToTx(req.body);
    await Mempool.addTransaction(tx);
    actions.sendSignedTx(tx);

    res.status(200).send('tx sended');
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
});

app.post('/prepeare/coin', async (req, res) => {
  let tx = req.body,
    data;
  try {
    data = await actions.prepareCoin(tx.from, tx.to, tx.amount);
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500);
  }
});

module.exports = app;

app.get('/peers', async (req, res) => {
  try {
    let data = await actions.getPeers();
    res.send(data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/moderators', async (req, res) => {
  try {
    let data = await actions.getModeratorsList();
    res.send(data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/balance/:address', async (req, res) => {
  try {
    let data = await actions.getBalance(req.params.address);
    res.send({ amount: data });
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/compliance/:address', async (req, res) => {
  try {
    let data = await actions.isAddressHaveCompliance(req.params.address);
    res.send(data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/competence/:address', async (req, res) => {
  try {
    let data = await actions.getAllUserSkills(req.params.address);
    res.send(data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/comments/:address', async (req, res) => {
  try {
    let data = await actions.getComments(req.params.address, 'all');
    res.send(data);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/arbitr/:hash', async (req, res) => {
  try {
    res.send(await actions.getArbitr(results.ref));
  } catch (e) {
    res.status(500).send(e);
  }
});

app.get('/info', async (req, res) => {
  try {
    res.send({
      dutyPrice: actions.getDutyPrice(),
      genesis: actions.genesis(),
    });
  } catch (e) {
    res.status(500).send(e);
  }
});
