import { connect } from 'react-redux';
import { blocksFetchAllData } from '../actions';

import Blocks from '../components/Blocks/Blocks';

const mapStateToProps = state => {
  return {
    blocks: state.blocks,
    hasErrored: state.blocksHasErrored,
    isLoading: state.blocksIsLoading,
  };
};

const mapDispatchToProps = dispatch => {
  return {
    fetchBlocksData: () => dispatch(blocksFetchAllData()),
  };
};

const ConnectedBlocks = connect(
  mapStateToProps,
  mapDispatchToProps
)(Blocks);

export default ConnectedBlocks;
