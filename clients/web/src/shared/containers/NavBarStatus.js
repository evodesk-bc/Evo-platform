import { connect } from 'react-redux';
import { peersFetchAllData } from '../actions';

import NavBarStatus from '../components/NavBar/NavBarStatus';

const mapStateToProps = state => {
  return {
    peers: state.peers,
    hasErrored: state.peersHasErrored,
    isLoading: state.peersIsLoading,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    fetchPeersData: () => dispatch(peersFetchAllData()),
  };
};

const ConnectedNavBarStatus = connect(
  mapStateToProps,
  mapDispatchToProps
)(NavBarStatus);

export default ConnectedNavBarStatus;
