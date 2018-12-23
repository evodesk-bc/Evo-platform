import { connect } from 'react-redux';
import { transactionsFetchAllData } from '../actions';

import Transactions from '../components/Transactions/Transactions';

const mapStateToProps = state => {
  return {
    transactions: state.transactions,
    hasErrored: state.transactionsHasErrored,
    isLoading: state.transactionsIsLoading,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    fetchTransactionsData: () => dispatch(transactionsFetchAllData()),
  };
};

const ConnectedTransactions = connect(
  mapStateToProps,
  mapDispatchToProps
)(Transactions);

export default ConnectedTransactions;
