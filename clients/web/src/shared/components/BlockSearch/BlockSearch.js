import React from 'react';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './BlockSearch.css';
import { Redirect } from 'react-router';
import axios from 'axios';

import config from '../../../../config';
import { blocksFetchAllData } from '../../actions';

axios.defaults.baseURL = config.api;

class BlockSearch extends React.Component {
  state = {
    byindex: false,
    redirect: false,
    target: '',
  };

  handleSubmitHash = event => {
    event.preventDefault();
    const data = new FormData(event.target);

    const path = `/blocks/${data.get('hash')}`;

    axios
      .get(path)
      .then(() => {
        this.setState({
          redirect: true,
          target: path,
        });
      })
      .catch(() => {
        alert(`Block not found!`);
      });
  };

  handleSubmitIndex = event => {
    event.preventDefault();
    const data = new FormData(event.target);

    axios
      .get(`/blockhashes/${data.get('index')}`)
      .then(res => {
        const path = `/blocks/${res.data}`;
        this.setState({
          redirect: true,
          target: path,
        });
      })
      .catch(() => {
        alert(`Block not found!`);
      });
  };

  render() {
    if (this.state.redirect) {
      return <Redirect to={this.state.target} />;
    }

    return (
      <section className="search">
        <div className="search__container">
          <form
            className="search__container__form"
            onSubmit={this.handleSubmitHash}
          >
            <label className="search__container__form__item" htmlFor="hash">
              Поиск по хешу:
            </label>
            <input
              className="search__container__form__item search__container__form__item-hash_input"
              id="hash"
              name="hash"
              placeholder="hash"
              type="text"
            />
            <button className="search__container__form__item">Найти</button>
          </form>
          <form
            className="search__container__form"
            onSubmit={this.handleSubmitIndex}
          >
            <label className="search__container__form__item" htmlFor="index">
              Поиск по индексу:
            </label>
            <input
              className="search__container__form__item"
              id="index"
              name="index"
              placeholder="index"
              type="text"
            />
            <button className="search__container__form__item">Найти</button>
          </form>
        </div>
      </section>
    );
  }
}

export default withStyles(s)(BlockSearch);
