import action from '../clients/actions';
import helper from '../node/helper';
import fs from 'fs';
import User from '../node/chainCode/user';
import Wallet from '../node/wallet';
import Coin from '../node/chainCode/coin';

function cli(vorpal) {
  vorpal
    .use(welcome)
    .use(start)
    .use(connect)
    .use(wallet)
    .use(blocks)
    .use(search)
    .use(peers)
    .use(sendTx)
    .use(unban)
    .use(ban)
    .use(sendMsg)
    .use(balance)
    .use(status)
    .use(test)
    .use(test2)
    .use(write)
    .use(mine)
    .use(testMem)
    .use(disconnect)
    .use(mempool)
    .use(stop)
    .use(moderator)
    .use(compliance)
    .use(sendComment)
    .use(competence)
    .use(arbitration)
    .use(transaction)
    .delimiter('Write command →')
    .show();
}

module.exports = cli;

// COMMANDS
async function welcome(vorpal) {
  vorpal.log('Welcome to Evodesk blockchain node!');
  vorpal.exec('help');

  try {
    const walletsList = await action.getChoiceWalletList();

    vorpal.exec('wallet -s');
  } catch (err) {
    vorpal.log('No wallets :( Please, create new wallet.');

    vorpal.exec('wallet');
  }
}

function start(vorpal) {
  vorpal
    .command('start', 'Sync (peering and seeding), --http --mining')
    .option('-h, --http', 'using RPC-JSON')
    .option('-m, --mining', 'mining blocks')
    .option('-t, --test', 'witout auto connections')
    .alias('o')
    .action(async (args, callback) => {
      const log = await action.startP2P(6000);

      this.log(`Starting node:
          addr| ${log.ip}
          port| ${log.port}
          STUN| ${log.stun}`);

      if (!args.options.test) await action.connectToAll();

      if (args.options.http) {
        const httpPort = 3000;
        this.log(`Starting http-server on ${log.ip}:${httpPort}`);
        action.startHTTP(httpPort);
      }

      if (args.options.mining) action.startMining();

      callback();
    });
}

function connect(vorpal) {
  vorpal
    .command('connect <host>', 'Connect to peer')
    .alias('c')
    .action((args, callback) => {
      action.connect(args.host);
      callback();
    });
}

function wallet(vorpal) {
  vorpal
    .command('wallet', 'generate new wallet')
    .option('-l, --list', 'list all wallets')
    .option(
      '-k, --keystore <privateKey>',
      'import wallet(create keystore) from private key(without 0x)'
    )
    .option('-s, --set', 'set default wallet')
    .alias('w')
    .types({ string: ['_'] })
    .action(async function(args, callback) {
      const self = this;

      if (args.options.list) {
        this.log((await action.listWallets()).str);

        callback();
      } else if (args.options.keystore) {
        return this.prompt(
          [
            {
              type: 'password',
              name: 'password',
              default: false,
              message: 'Enter password: ',
            },
            {
              type: 'password',
              name: 'password2',
              default: false,
              message: 'Confirm password: ',
            },
          ],
          function(answers) {
            if (answers.password != answers.password2) {
              self.log('Passwords must match!');

              return callback();
            }

            self.log(
              action.createKeystore(
                '0x' + args.options.keystore,
                answers.password
              )
            );

            callback();
          }
        );
      } else if (args.options.set) {
        const choiceList = await action.getChoiceWalletList();

        return this.prompt(
          [
            {
              type: 'list',
              name: 'wallet',
              message: 'Please, choose one of the following wallets:',
              choices: choiceList,
            },
            {
              type: 'password',
              name: 'password',
              message: 'Enter password: ',
            },
          ],
          function(answers) {
            self.log(action.setDefaultWallet(answers.wallet, answers.password));
          }
        );
      } else {
        return this.prompt(
          [
            {
              type: 'password',
              name: 'password',
              default: false,
              message: 'Enter password: ',
            },
            {
              type: 'password',
              name: 'password2',
              default: false,
              message: 'Confirm password: ',
            },
          ],
          function(answers) {
            if (answers.password != answers.password2) {
              self.log('Passwords must match!');

              return vorpal.execSync('wallet');
            }

            self.log(action.createWallet(answers.password));
            callback();
          }
        );
      }
    });
}

function blocks(vorpal) {
  vorpal
    .command('blocks', 'all verifed blocks')
    .alias('b')
    .option('-q, --quantity', 'last verifed block')
    .types({ string: ['_'] })
    .action(async (args, callback) => {
      if (args.options.quantity)
        this.log(await action.getAllBlocks('quantity'));
      else this.log(await action.getAllBlocks());

      callback();
    });
}

function peers(vorpal) {
  vorpal
    .command('peers', 'list of peers from DHT table')
    .action(async (args, callback) => {
      this.log(await action.getPeers());
      callback();
    });
}

function search(vorpal) {
  vorpal
    .command('search <data>', 'search blocks/tranasctions/address from hash')
    .alias('sch')
    .option('-b, --blocks', 'address transactions')
    .option('-t, --trans', 'address transactions')
    .option('-a, --address', 'address transactions')
    .action(async (args, callback) => {
      let result;

      if (args.data) {
        if (args.options.address) result = await action.search('a', args.data);
        else if (args.options.trans)
          result = await action.search('t', args.data);
        else if (args.options.blocks)
          result = await action.search('b', args.data);

        this.log(result);
      } else this.log('Please, input data.');

      callback();
    });
}

function sendComment(vorpal) {
  vorpal
    .command('comment', 'Send/get comments')
    .alias('com')
    .types({ string: ['_'] })
    .option('-s, --send', 'send comment')
    .option('-g, --get', 'get comments')
    .action(async function(args, callback) {
      const self = this;

      if (args.options.get) {
        return this.prompt(
          [
            {
              type: 'input',
              name: 'address',
              message: 'Enter wallet address: ',
            },
            {
              type: 'input',
              name: 'code',
              default: 'all',
              message:
                'Enter code of competence(enter "all" for displaying all): ',
            },
          ],
          async function(answers) {
            self.log(await action.getComments(answers.address, answers.code));

            return callback();
          }
        );
      }

      return this.prompt(
        [
          {
            type: 'input',
            name: 'address',
            message: 'Enter wallet address: ',
          },
          {
            type: 'list',
            name: 'mark',
            choices: ['+', '-'],
            message: 'Select mark type: ',
          },
          {
            type: 'input',
            name: 'code',
            message: 'Enter code of competence: ',
          },
          {
            type: 'input',
            name: 'commentTxt',
            message: 'Enter comment: ',
          },
        ],
        async function(answers) {
          if (User.isDefaultWalletSet()) {
            try {
              if (args.options.send) {
                self.log(
                  await action.sendComment(
                    answers.mark,
                    answers.commentTxt,
                    answers.code,
                    answers.address
                  )
                );
              }
            } catch (err) {
              self.log('Error: ' + err + '\n' + err.stack);
            }

            return callback();
          }

          const choiceList = await action.getChoiceWalletList();
          return self.prompt(
            [
              {
                type: 'list',
                name: 'wallet',
                message: 'Please, choose one of the following wallets:',
                choices: choiceList,
              },
              {
                type: 'password',
                name: 'password',
                message: 'Enter password: ',
              },
            ],
            async function(answers1) {
              try {
                if (args.options.send) {
                  self.log(
                    await action.sendComment(
                      answers.mark,
                      answers.commentTxt,
                      answers.code,
                      answers.address,
                      answers1.wallet,
                      answers1.password
                    )
                  );
                }
              } catch (err) {
                self.log('Error: ' + err + '\n' + err.stack);
              }

              callback();
            }
          );
        }
      );
    });
}

function sendTx(vorpal) {
  vorpal
    .command('send <data> <to>', 'Sending a transaction with Evocoin')
    .alias('send')
    .option('-m, --message', 'send message transaction. data - text message.')
    .option('-c, --coin', 'send coin transaction. data - evocoin amount.')
    .types({ string: ['_'] })
    .action(async function(args, callback) {
      if (!Object.keys(args.options).length) {
        this.log('Enter one of the options');

        return callback();
      }

      if (User.isDefaultWalletSet()) {
        try {
          if (args.options.message) {
            this.log(await action.sendTx(args.data, args.to));
          } else if (args.options.coin) {
            this.log(await action.sendCoin(args.data, args.to));
          }
        } catch (err) {
          this.log('Error: ' + err + '\n' + err.stack);
        }

        return callback();
      }

      const choiceList = await action.getChoiceWalletList();

      const self = this;
      return this.prompt(
        [
          {
            type: 'list',
            name: 'wallet',
            message: 'Please, choose one of the following wallets:',
            choices: choiceList,
          },
          {
            type: 'password',
            name: 'password',
            message: 'Enter password: ',
          },
        ],
        async function(answers) {
          try {
            if (args.options.message) {
              self.log(
                await action.sendTx(
                  args.data,
                  args.to,
                  answers.wallet,
                  answers.password
                )
              );
            } else if (args.options.coin) {
              self.log(
                await action.sendCoin(
                  args.data,
                  args.to,
                  answers.wallet,
                  answers.password
                )
              );
            }
          } catch (err) {
            self.log('Error: ' + err + '\n' + err.stack);
          }

          callback();
        }
      );
    });
}

function hosts(vorpal) {
  vorpal
    .command('')
    .alias('host <host>')
    .option('-n, --new', 'add new host to basic list')
    .option('-rv, --remove', 'remove host from basic list')
    .option('-rs, --reset', 'reset all hosts to start list')
    .action((args, callback) => {
      if (args.host) {
        if (args.options.new) acthion.addHost(args.host);
        if (args.options.remove) action.removeHost(args.host);
      }
      if (args.options.reset) action.resetHosts();

      this.log(action.getHosts());
    });
}

function sendMsg(vorpal) {
  vorpal
    .command('sendm <message>', 'send message to all')
    .types({ string: ['_'] })
    .action((args, callback) => {
      action.sendText(args.message);
      callback();
    });
}

function unban(vorpal) {
  vorpal.command('unban', 'unbun all ips').action((args, callback) => {
    action.unbanAll();
    callback();
  });
}

function ban(vorpal) {
  vorpal
    .command('ban <ip>', 'block incoming messages from single ip')
    .action((args, callback) => {
      action.banIP(args.ip);
      callback();
    });
}

async function balance(vorpal) {
  vorpal
    .command('balance <address>', 'Get balance from address')
    .types({ string: ['_'] })
    .action(async (args, callback) => {
      this.log(await action.getBalance(args.address));
      callback();
    });
}

function status(vorpal) {
  vorpal
    .command('status', 'Get current node status')
    .types({ string: ['_'] })
    .action((args, callback) => {
      this.log(action.getStatus());
      callback();
    });
}

function disconnect(vorpal) {
  vorpal
    .command('disconnect', 'Disconnect form all peers')
    .types({ string: ['_'] })
    .action((args, callback) => {
      action.disconnect();
      callback();
    });
}

function test(vorpal) {
  vorpal
    .command('test <amount> <delay>', 'test transaction sending')
    .action(async (args, callback) => {
      setInterval(async () => {
        const unit = await Wallet.generate();
        this.log(await action.sendCoin(args.amount, `0x${unit.Address}`));
      }, args.delay);
      callback();
    });
}

function test2(vorpal) {
  vorpal
    .command('test2 <txs>', 'test transaction sending')
    .action(async (args, callback) => {
      for (let i = 0; i < args.txs; i++) {
        this.log(
          await action.sendCoin(
            args.amount,
            `0x${await Wallet.generate().Address}`
          )
        );
      }
      callback();
    });
}

function write(vorpal) {
  vorpal.command('write <filename>').action(async (args, callback) => {
    await fs.writeFile(
      args.filename + '.json',
      JSON.stringify(action.getMempool()),
      'utf8',
      function() {
        console.log('ok');
      }
    );
  });
}

function push(vorpal) {
  vorpal.command('push').action(async (args, callback) => {
    let initPool = await fs.readFileSync('init.json'),
      testTxs = await fs.readFileSync('txs.json');

    initPool = JSON.parse(initPool);
    for (let i = 0; i < initPool.length; i++) {
      initPool[i] = helper.fromObjToTx(initPool[i]);
    }

    testTxs = JSON.parse(testTxs);
    for (let i = 0; i < testTxs.length; i++) {
      testTxs[i] = helper.fromObjToTx(testTxs[i]);
    }

    action.setMempool(initPool);
    console.log('до майнинга ' + action.getMempool().length);
    await action.startMining();
    setTimeout(() => {
      action.stopMining();
      console.log('номайнил');
    }, 1001);
    setTimeout(() => {
      action.setMempool(testTxs);
      console.log('готово!');
    }, 2001);
  });
}

function mine(vorpal) {
  vorpal
    .command('mine', 'Mine block')
    .alias('m')
    //.option('-l, --log', 'logged mining process.')
    .types({ string: ['_'] })
    .action(async function(args, callback) {
      if (User.isDefaultWalletSet()) {
        try {
          this.log(await action.startMining());
        } catch (err) {
          this.log('Error: ' + err + '\n' + err.stack);
        }

        return callback();
      }

      const choiceList = await action.getChoiceWalletList();

      const self = this;
      return this.prompt(
        [
          {
            type: 'list',
            name: 'wallet',
            message: 'Please, choose one of the following wallets:',
            choices: choiceList,
          },
          {
            type: 'password',
            name: 'password',
            message: 'Enter password: ',
          },
        ],
        async function(answers) {
          try {
            self.log(
              await action.startMining(answers.wallet, answers.password)
            );
          } catch (err) {
            self.log('Error: ' + err + '\n' + err.stack);
          }

          callback();
        }
      );
    });
}

function testMem(vorpal) {
  vorpal
    .command('testmine', '')
    .alias('mem')
    .types({ string: ['_'] })
    .action(async (args, callback) => {
      this.log(await action._startMining());
      callback();
    });
}

function mempool(vorpal) {
  vorpal
    .command('mempool', '')
    .alias('memp')
    .types({ string: ['_'] })
    .option('-s, --show', 'show all mempool')
    .option('-l, --length', 'amount txs in mempool')
    .option('-c, --clear', 'clear mempool')
    .action(async (args, callback) => {
      if (args.options.length) this.log(action.getMempool().length);

      if (args.options.show) this.log(action.getMempool());

      if (args.options.clear) {
        this.log('cleaned', action.clearMempool());
      }

      callback();
    });
}

function stop(vorpal) {
  vorpal
    .command('stop', 'Stop mining')
    .alias('s')
    .types({ string: ['_'] })
    .action(async (args, callback) => {
      this.log(action.stopMining());
      this.log('майнинг приостановлен');
      callback();
    });
}

function moderator(vorpal) {
  vorpal
    .command('moderator', 'Add/remove/vote/show moderators')
    .alias('mr')
    .types({ string: ['_'] })
    .option('-a, --add', 'add new moderator(only admin and some moderators)')
    .option('-r, --remove', 'remove moderator(only admin)')
    .option('-v, --vote', 'vote for a new moderator(only moderators)')
    .option('-g, --get', 'get votes count for the address')
    .option('-l, --list', 'show all moderators')
    .action(async function(args, callback) {
      const self = this;

      if (args.options.list) {
        this.log(await action.getModeratorsList());

        return callback();
      }

      return this.prompt(
        [
          {
            type: 'input',
            name: 'address',
            message: 'Enter wallet address: ',
          },
        ],
        async function(answers) {
          if (args.options.get) {
            self.log(await action.getVotesCount(answers.address));

            return callback();
          }

          if (User.isDefaultWalletSet()) {
            try {
              if (args.options.add) {
                self.log(await action.addModerator(answers.address));
              } else if (args.options.remove) {
                self.log(await action.removeModerator(answers.address));
              } else if (args.options.vote) {
                self.log(await action.voteForModerator(answers.address));
              }
            } catch (err) {
              self.log('Error: ' + err + '\n' + err.stack);
            }

            return callback();
          }

          const choiceList = await action.getChoiceWalletList();
          return self.prompt(
            [
              {
                type: 'list',
                name: 'wallet',
                message: 'Please, choose one of the following wallets:',
                choices: choiceList,
              },
              {
                type: 'password',
                name: 'password',
                message: 'Enter password: ',
              },
            ],
            async function(answers1) {
              try {
                if (args.options.add) {
                  self.log(
                    await action.addModerator(
                      answers.address,
                      answers1.wallet,
                      answers1.password
                    )
                  );
                } else if (args.options.remove) {
                  self.log(
                    await action.removeModerator(
                      answers.address,
                      answers1.wallet,
                      answers1.password
                    )
                  );
                } else if (args.options.vote) {
                  self.log(
                    await action.voteForModerator(
                      answers.address,
                      answers1.wallet,
                      answers1.password
                    )
                  );
                }
              } catch (err) {
                self.log('Error: ' + err + '\n' + err.stack);
              }

              callback();
            }
          );
        }
      );
    });
}

function compliance(vorpal) {
  vorpal
    .command('compliance', 'Send/check compliance')
    .alias('cm')
    .types({ string: ['_'] })
    .option('-s, --send', 'send compliance(only moderators)')
    .option('-c, --check', 'check compliance')
    .action(async function(args, callback) {
      const self = this;

      if (args.options.check) {
        return this.prompt(
          [
            {
              type: 'input',
              name: 'address',
              message: 'Enter wallet address: ',
            },
          ],
          async function(answers) {
            self.log(await action.isAddressHaveCompliance(answers.address));

            return callback();
          }
        );
      }

      return this.prompt(
        [
          {
            type: 'input',
            name: 'address',
            message: 'Enter wallet address: ',
          },
          {
            type: 'input',
            name: 'fullName',
            message: 'Enter user Full Name: ',
          },
        ],
        async function(answers) {
          if (User.isDefaultWalletSet()) {
            try {
              if (args.options.send) {
                self.log(
                  await action.sendCompliance(answers.address, answers.fullName)
                );
              }
            } catch (err) {
              self.log('Error: ' + err + '\n' + err.stack);
            }

            return callback();
          }

          const choiceList = await action.getChoiceWalletList();
          return self.prompt(
            [
              {
                type: 'list',
                name: 'wallet',
                message: 'Please, choose one of the following wallets:',
                choices: choiceList,
              },
              {
                type: 'password',
                name: 'password',
                message: 'Enter password: ',
              },
            ],
            async function(answers1) {
              try {
                if (args.options.send) {
                  self.log(
                    await action.sendCompliance(
                      answers.address,
                      answers.fullName,
                      answers1.wallet,
                      answers1.password
                    )
                  );
                }
              } catch (err) {
                self.log('Error: ' + err + '\n' + err.stack);
              }

              callback();
            }
          );
        }
      );
    });
}

function competence(vorpal) {
  vorpal
    .command('competence <address>', 'get user competences')
    .alias('cmt')
    .types({ string: ['_'] })
    .action(async function(args, callback) {
      this.log(await action.getAllUserSkills(args.address));
    });
}

function transaction(vorpal) {
  vorpal
    .command('transactions', 'get transactions')
    .alias('tx')
    .types({ string: ['_'] })
    .option('-h, --hash <txHash>', 'get transaction by hash')
    .option('-t, --type <txType>', 'get transactions by type')
    .option(
      '-s, --sender <senderAddress>',
      'get transactions by sender address'
    )
    .action(async function(args, callback) {
      const searchOpts = args.options;
      this.log(await action.getTransactions(searchOpts));
    });
}

function arbitration(vorpal) {
  vorpal
    .command('arbitration', 'send arbitration')
    .alias('arb')
    .types({ string: ['_'] })
    .option('-s, --send', 'send arbitration(')
    .option('-g, --get', 'get arbitration')
    .action(async function(args, callback) {
      const self = this;
      if (args.options.send) {
        return this.prompt(
          [
            {
              type: 'input',
              message: 'Enter hash of comment transaction: ',
              name: 'ref',
            },
            {
              type: 'input',
              message: 'Enter comment: ',
              name: 'text',
            },
            {
              type: 'list',
              message: 'Choose type of transaction: ',
              name: 'action',
              choices: ['create', 'accept', 'close'],
            },
          ],
          async results => {
            self.log(
              await action.sendArbitr(results.ref, results.text, results.action)
            );
          }
        );
      }

      if (args.options.get)
        return this.prompt(
          [
            {
              type: 'input',
              message: 'Enter hash of comment transaction: ',
              name: 'ref',
            },
          ],
          async results => {
            let answer = await action.getArbitr(results.ref);
            this.log(
              `Статус заявки ${answer.status}, в связи с ${answer.text}`
            );
          }
        );
    });
}
