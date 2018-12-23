import React from 'react';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Balance.css';
import axios from 'axios';

import config from '../../../../config';

axios.defaults.baseURL = config.api;

class Balance extends React.Component {
  state = {
    address: '',
    amount: 0,
    isSeached: false,
  };

  handleSubmitBalance = event => {
    event.preventDefault();
    const data = new FormData(event.target);
    axios
      .get(`/balance/${data.get('address')}`)
      .then(res => {
        if (res.data.amount !== 'invalid address') {
          this.setState({
            address: data.get('address'),
            amount: res.data.amount,
            isSeached: true,
          });
        } else {
          alert(`Wallet not found!`);
          this.setState({
            isSeached: false,
          });
        }
      })
      .catch(() => {
        alert(`Server Error`);
      });
  };
  renderBalance = () => {
    if (!this.state.isSeached) {
      return <p>Введите адрес кошелька в форму :)</p>;
    }
    return (
      <div>
        <p>Адрес: {this.state.address}</p>
        <p>Баланс: {this.state.amount}</p>
      </div>
    );
  };

  render() {
    return (
      <React.Fragment>
        <section className="search">
          <div className="search__container">
            <form
              className="search__container__form"
              onSubmit={this.handleSubmitBalance}
            >
              <label className="search__container__form__item" htmlFor="hash">
                Поиск по адресу:
              </label>
              <input
                className="search__container__form__item"
                id="address"
                name="address"
                placeholder="address"
                type="text"
              />
              <button className="search__container__form__item">Найти</button>
            </form>
          </div>
        </section>
        <section className="balance">{this.renderBalance()}</section>
      </React.Fragment>
    );
  }
}

export default withStyles(s)(Balance);
