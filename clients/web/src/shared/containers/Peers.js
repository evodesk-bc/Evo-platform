import { connect } from 'react-redux';
import { peersFetchAllData } from '../actions';

import Peers from '../components/Peers/Peers';

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

const ConnectedPeers = connect(
  mapStateToProps,
  mapDispatchToProps
)(Peers);

export default ConnectedPeers;
