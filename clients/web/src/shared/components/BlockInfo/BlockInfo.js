import React from 'react';
import { List } from 'react-virtualized';
import { Link } from 'react-router-dom';
import axios from 'axios';

import config from '../../../../config';

axios.defaults.baseURL = config.api;

import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './BlockInfo.css';

class BlockInfo extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasErrored: false,
      isLoading: true,
    };
  }

  componentDidMount() {
    axios
      .get(`/blocks/${this.props.match.params.hash}`)
      .then(res => {
        this.setState({
          isLoading: false,
          ...res.data,
        });
      })
      .catch(e => {
        this.setState({
          isLoading: false,
          hasErrored: true,
        });
      });
  }

  render() {
    if (this.state.hasErrored) {
      return <p>Sorry! There was an error loading data</p>;
    }

    if (this.state.isLoading) {
      return <p>Loading…</p>;
    }

    const exceptions = ['hasErrored', 'isLoading', 'txs'];

    const BlockInfoRender = Object.entries(this.state).map((row, i) => {
      if (exceptions.includes(row[0])) return;
      return (
        <div key={i} className="block_info__item">
          <p className="block_info__item__label">{row[0]}:</p>
          <p className="block_info__item__info">{row[1]}</p>
        </div>
      );
    });

    const rowRender = ({ index, style }) => {
      const path = `/transactions/${this.state.txs[index].hash}`;
      return (
        <div key={index} style={style}>
          <div>
            <Link to={path}>{this.state.txs[index].hash}</Link>
          </div>
        </div>
      );
    };

    return (
      <div className="block_info">
        <div>{BlockInfoRender}</div>
        <div>
          <p className="block_info__item__label">txs:</p>
          <div className="block_info__txs">
            <List
              width={700}
              height={500}
              rowCount={this.state.txs.length}
              rowHeight={50}
              rowRenderer={rowRender}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default withStyles(s)(BlockInfo);
