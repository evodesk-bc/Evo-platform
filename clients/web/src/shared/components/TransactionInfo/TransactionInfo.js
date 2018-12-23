import React from 'react';
import { List } from 'react-virtualized';
import axios from 'axios';

import config from '../../../../config';

axios.defaults.baseURL = config.api;

import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './TransactionInfo.css';

class TransactionInfo extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasErrored: false,
      isLoading: true,
    };
  }

  componentDidMount() {
    axios
      .get(`/transactions/${this.props.match.params.hash}`)
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

    const exceptions = ['hasErrored', 'isLoading', 'data'];

    const TransactionInfoRender = Object.entries(this.state).map((row, i) => {
      if (exceptions.includes(row[0])) return;
      return (
        <div key={i} className="transaction_info__item">
          <p className="transaction_info__item__label">{row[0]}:</p>
          <p className="transaction_info__item__info">{row[1]}</p>
        </div>
      );
    });

    if (this.state.data.type == 'coin') {
      const inputsRowRender = ({ index, style }) => {
        return (
          <div key={index} style={style}>
            <div>
              <p className="transaction_info__item__info">
                txHash: {this.state.data.inputs[index].txHash}
              </p>
              <p className="transaction_info__item__info">
                index: {this.state.data.inputs[index].index}
              </p>
              <p className="transaction_info__item__info">
                amount: {this.state.data.inputs[index].amount}
              </p>
            </div>
          </div>
        );
      };

      const outputsRowRender = ({ index, style }) => {
        return (
          <div key={index} style={style}>
            <div>
              <p className="transaction_info__item__info">
                address: {this.state.data.outputs[index].address}
              </p>
              <p className="transaction_info__item__info">
                amount: {this.state.data.outputs[index].amount}
              </p>
            </div>
          </div>
        );
      };

      return (
        <div className="transaction_info">
          <div>
            {TransactionInfoRender}
            <div className="transaction_info__item">
              <p className="transaction_info__item__label">type:</p>
              <p className="transaction_info__item__info">
                {this.state.data.type}
              </p>
            </div>
            <div className="transaction_info__item">
              <p className="transaction_info__item__label">comission:</p>
              <p className="transaction_info__item__info">
                {this.state.data.comission}
              </p>
            </div>
          </div>
          <div>
            <p className="transaction_info__item__label">inputs:</p>
            <div className="transaction_info__txs">
              <List
                width={700}
                height={300}
                rowCount={this.state.data.inputs.length}
                rowHeight={150}
                rowRenderer={inputsRowRender}
              />
            </div>
            <p className="transaction_info__item__label">outputs:</p>
            <div className="transaction_info__txs">
              <List
                width={700}
                height={300}
                rowCount={this.state.data.inputs.length}
                rowHeight={100}
                rowRenderer={outputsRowRender}
              />
            </div>
          </div>
        </div>
      );
    } else {
      const TransactionDataInfoRender = Object.entries(this.state.data).map(
        (row, i) => {
          return (
            <div key={i} className="transaction_info__item">
              <p className="transaction_info__item__label">{row[0]}:</p>
              <p className="transaction_info__item__info">{row[1]}</p>
            </div>
          );
        }
      );

      return (
        <div className="transaction_info">
          <div>{TransactionInfoRender}</div>
          <div>{TransactionDataInfoRender}</div>
        </div>
      );
    }
  }
}

export default withStyles(s)(TransactionInfo);
