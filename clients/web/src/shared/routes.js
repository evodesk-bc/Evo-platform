import Blocks from './containers/Blocks.js';
import Transactions from './containers/Transactions.js';
import Peers from './containers/Peers.js';
import Mempool from './containers/Mempool.js';
import BlockInfo from './components/BlockInfo/BlockInfo.js';
import TransactionInfo from './components/TransactionInfo/TransactionInfo';
import Balance from './components/Balance/Balance.js';

const routes = [
  {
    path: '/blocks',
    exact: true,
    component: Blocks,
  },
  {
    path: '/transactions',
    exact: true,
    component: Transactions,
  },
  {
    path: '/peers',
    exact: true,
    component: Peers,
  },
  {
    path: '/mempool',
    exact: true,
    component: Mempool,
  },
  {
    path: '/balance',
    exact: true,
    component: Balance,
  },
  {
    path: '/transactions/:hash',
    component: TransactionInfo,
  },
  {
    path: '/blocks/:hash',
    component: BlockInfo,
  },
];

export default routes;
