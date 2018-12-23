import React from 'react';
import { List } from 'react-virtualized';
import axios from 'axios';

import config from '../../../../config';

axios.defaults.baseURL = config.api;

import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Peers.css';

class Peers extends React.Component {
  componentDidMount() {
    this.props.fetchPeersData();
  }

  readStatus = statusNum => {
    switch (statusNum) {
      case 0:
        return 'online';
      case 1:
        return 'offline';
      case 2:
        return 'banned';
    }
  };

  render() {
    if (this.props.hasErrored) {
      return <p>Sorry! There was an error loading data</p>;
    }

    if (this.props.isLoading) {
      return <p>Loading…</p>;
    }

    const rowRender = ({ index, style }) => {
      return (
        <div key={index} style={style}>
          <div>
            <p>ip: {this.props.peers[index].key}</p>
            <p>status: {this.readStatus(this.props.peers[index].value)}</p>
          </div>
        </div>
      );
    };

    return (
      <React.Fragment>
        <section className="peers">
          <List
            width={1920}
            height={500}
            rowCount={this.props.peers.length}
            rowHeight={100}
            rowRenderer={rowRender}
          />
        </section>
      </React.Fragment>
    );
  }
}

export default withStyles(s)(Peers);
