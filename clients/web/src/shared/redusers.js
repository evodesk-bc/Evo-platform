import { combineReducers } from 'redux';

export function blocksHasErrored(state = false, action) {
  switch (action.type) {
    case 'BLOCKS_HAS_ERRORED':
      return action.hasErrored;
    default:
      return state;
  }
}

export function blocksIsLoading(state = false, action) {
  switch (action.type) {
    case 'BLOCKS_IS_LOADING':
      return action.isLoading;
    default:
      return state;
  }
}

function blocks(state = [], action) {
  switch (action.type) {
    case 'BLOCKS_FETCH_ALL_DATA':
      return action.blocks;
    default:
      return state;
  }
}

export function transactionsHasErrored(state = false, action) {
  switch (action.type) {
    case 'TRANSACTIONS_HAS_ERRORED':
      return action.hasErrored;
    default:
      return state;
  }
}

export function transactionsIsLoading(state = false, action) {
  switch (action.type) {
    case 'TRANSACTIONS_IS_LOADING':
      return action.isLoading;
    default:
      return state;
  }
}

function transactions(state = [], action) {
  switch (action.type) {
    case 'TRANSACTIONS_FETCH_ALL_DATA':
      return action.transactions;
    default:
      return state;
  }
}

export function peersHasErrored(state = false, action) {
  switch (action.type) {
    case 'PEERS_HAS_ERRORED':
      return action.hasErrored;
    default:
      return state;
  }
}

export function peersIsLoading(state = false, action) {
  switch (action.type) {
    case 'PEERS_IS_LOADING':
      return action.isLoading;
    default:
      return state;
  }
}

function peers(state = [], action) {
  switch (action.type) {
    case 'PEERS_FETCH_ALL_DATA':
      return action.peers;
    default:
      return state;
  }
}

export function mempoolHasErrored(state = false, action) {
  switch (action.type) {
    case 'MEMPOOL_HAS_ERRORED':
      return action.hasErrored;
    default:
      return state;
  }
}

export function mempoolIsLoading(state = false, action) {
  switch (action.type) {
    case 'MEMPOOL_IS_LOADING':
      return action.isLoading;
    default:
      return state;
  }
}

function mempool(state = [], action) {
  switch (action.type) {
    case 'MEMPOOL_FETCH_ALL_DATA':
      return action.mempool;
    default:
      return state;
  }
}

export default combineReducers({
  blocks,
  blocksHasErrored,
  blocksIsLoading,
  transactions,
  transactionsHasErrored,
  transactionsIsLoading,
  peers,
  peersHasErrored,
  peersIsLoading,
  mempool,
  mempoolHasErrored,
  mempoolIsLoading,
});
