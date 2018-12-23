import React from 'react';
import { List } from 'react-virtualized';
import { Link } from 'react-router-dom';

import TransactionSearch from '../TransactionSearch/TransactionSearch';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Transactions.css';

class TransactionItem extends React.Component {
  render() {
    const path = `/transactions/${this.props.hash}`;

    return (
      <div>
        <p> type: {this.props.type} </p>
        <p>
          {' '}
          hash: <Link to={path}> {this.props.hash}</Link>{' '}
        </p>
      </div>
    );
  }
}

class Transactions extends React.Component {
  componentDidMount() {
    this.props.fetchTransactionsData();
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
          <TransactionItem
            type={this.props.transactions[index].data.type}
            hash={this.props.transactions[index].hash}
          />
        </div>
      );
    };

    return (
      <React.Fragment>
        <TransactionSearch />
        <section className="transactions">
          <List
            width={1920}
            height={500}
            rowCount={this.props.transactions.length}
            rowHeight={100}
            rowRenderer={_rowRender}
          />
        </section>
      </React.Fragment>
    );
  }
}

export default withStyles(s)(Transactions);
