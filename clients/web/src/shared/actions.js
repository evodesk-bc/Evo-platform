import axios from 'axios';

import config from '../../config';

axios.defaults.baseURL = config.api;

// actions

export function blocksFetchAllDataSuccess(blocks) {
  return {
    type: 'BLOCKS_FETCH_ALL_DATA',
    blocks,
  };
}

export function blocksHasErrored(bool) {
  return {
    type: 'BLOCKS_HAS_ERRORED',
    hasErrored: bool,
  };
}

export function blocksIsLoading(bool) {
  return {
    type: 'BLOCKS_IS_LOADING',
    isLoading: bool,
  };
}

export function transactionsFetchAllDataSuccess(transactions) {
  return {
    type: 'TRANSACTIONS_FETCH_ALL_DATA',
    transactions,
  };
}

export function transactionsHasErrored(bool) {
  return {
    type: 'TRANSACTIONS_HAS_ERRORED',
    hasErrored: bool,
  };
}

export function transactionsIsLoading(bool) {
  return {
    type: 'TRANSACTIONS_IS_LOADING',
    isLoading: bool,
  };
}

export function peersFetchAllDataSuccess(peers) {
  return {
    type: 'PEERS_FETCH_ALL_DATA',
    peers,
  };
}

export function peersHasErrored(bool) {
  return {
    type: 'PEERS_HAS_ERRORED',
    hasErrored: bool,
  };
}

export function peersIsLoading(bool) {
  return {
    type: 'PEERS_IS_LOADING',
    isLoading: bool,
  };
}

export function mempoolFetchAllDataSuccess(mempool) {
  return {
    type: 'MEMPOOL_FETCH_ALL_DATA',
    mempool,
  };
}

export function mempoolHasErrored(bool) {
  return {
    type: 'MEMPOOL_HAS_ERRORED',
    hasErrored: bool,
  };
}

export function mempoolIsLoading(bool) {
  return {
    type: 'MEMPOOL_IS_LOADING',
    isLoading: bool,
  };
}

// action creators

export function blocksFetchAllData() {
  return dispatch => {
    dispatch(blocksIsLoading(true));

    axios
      .get('/blockhashes')
      .then(res => {
        dispatch(blocksIsLoading(false));
        dispatch(blocksFetchAllDataSuccess(res.data));
      })
      .catch(() => dispatch(blocksHasErrored(true)));
  };
}

export function transactionsFetchAllData() {
  return dispatch => {
    dispatch(transactionsIsLoading(true));

    axios
      .get('/transactions')
      .then(res => {
        dispatch(transactionsIsLoading(false));
        dispatch(transactionsFetchAllDataSuccess(res.data));
      })
      .catch(() => dispatch(transactionsHasErrored(true)));
  };
}

export function peersFetchAllData() {
  return dispatch => {
    dispatch(peersIsLoading(true));

    axios
      .get('/peers')
      .then(res => {
        dispatch(peersIsLoading(false));
        dispatch(peersFetchAllDataSuccess(res.data));
      })
      .catch(() => dispatch(peersHasErrored(true)));
  };
}

export function mempoolFetchAllData() {
  return dispatch => {
    dispatch(mempoolIsLoading(true));

    axios
      .get('/mempool')
      .then(res => {
        dispatch(mempoolIsLoading(false));
        dispatch(mempoolFetchAllDataSuccess(res.data));
      })
      .catch(() => dispatch(mempoolHasErrored(true)));
  };
}
