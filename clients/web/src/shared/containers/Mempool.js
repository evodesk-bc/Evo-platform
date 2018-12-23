import { connect } from 'react-redux';
import { mempoolFetchAllData } from '../actions';

import Mempool from '../components/Mempool/Mempool';

const mapStateToProps = state => {
  return {
    mempool: state.mempool,
    hasErrored: state.mempoolHasErrored,
    isLoading: state.mempoolIsLoading,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    fetchMempoolData: () => dispatch(mempoolFetchAllData()),
  };
};

const ConnectedMempool = connect(
  mapStateToProps,
  mapDispatchToProps
)(Mempool);

export default ConnectedMempool;
