import React from 'react';
import { List } from 'react-virtualized';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Mempool.css';

class Mempool extends React.Component {
  componentDidMount() {
    this.props.fetchMempoolData();
  }

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
            <p>type: {this.props.mempool[index].data.type}</p>
            <p>hash: {this.props.mempool[index].hash}</p>
          </div>
        </div>
      );
    };

    return (
      <React.Fragment>
        <section className="mempool">
          <List
            width={1920}
            height={500}
            rowCount={this.props.mempool.length}
            rowHeight={100}
            rowRenderer={rowRender}
          />
        </section>
      </React.Fragment>
    );
  }
}

export default withStyles(s)(Mempool);
