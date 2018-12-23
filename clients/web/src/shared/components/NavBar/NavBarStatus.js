import React from 'react';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './NavBarStatus.css';

class NavBarStatus extends React.Component {
  componentDidMount() {
    this.props.fetchPeersData();
  }
  countOnlinePeers = peers => {
    let count = 0;
    peers.forEach(peer => {
      if (peer.value === 0) count++;
    });
    return count;
  };
  renderContent = () => {
    if (this.props.isLoading) {
      return <p className="navbar__status__peers">loading ...</p>;
    }
    if (this.props.hasErrored) {
      return <p className="navbar__status__peers">Can't load peer's data</p>;
    }
    return (
      <p className="navbar__status__peers">
        Nodes online: {this.countOnlinePeers(this.props.peers) + 1}
      </p>
    );
  };
  render() {
    return <div className="navbar__status">{this.renderContent()}</div>;
  }
}

export default withStyles(s)(NavBarStatus);
