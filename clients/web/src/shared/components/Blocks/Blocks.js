import React from 'react';
import { List } from 'react-virtualized';
import { Link } from 'react-router-dom';

import BlockSearch from '../BlockSearch/BlockSearch';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Blocks.css';

class BlockItem extends React.Component {
  render() {
    const path = `/blocks/${this.props.hash}`;

    return (
      <div>
        <p> Block #{this.props.index} </p>
        <p>
          {' '}
          hash: <Link to={path}> {this.props.hash}</Link>{' '}
        </p>
      </div>
    );
  }
}

class Blocks extends React.Component {
  componentDidMount() {
    this.props.fetchBlocksData();
  }

  render() {
    if (this.props.hasErrored) {
      return <p>Sorry! There was an error loading data</p>;
    }

    if (this.props.isLoading) {
      return <p>Loading…</p>;
    }

    const _rowRender = ({ index, style }) => {
      return (
        <div key={index} style={style}>
          <BlockItem
            index={this.props.blocks[index].index}
            hash={this.props.blocks[index].hash}
          />
        </div>
      );
    };

    return (
      <React.Fragment>
        <BlockSearch />
        <section className="blocks">
          <List
            width={1920}
            height={500}
            rowCount={this.props.blocks.length}
            rowHeight={100}
            rowRenderer={_rowRender}
          />
        </section>
      </React.Fragment>
    );
  }
}

export default withStyles(s)(Blocks);
