import React from 'react';
import { NavLink } from 'react-router-dom';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './NavBar.css';
import NavBarStatus from '../../containers/NavBarStatus';

class NavBar extends React.Component {
  render() {
    return (
      <section className="navbar">
        <div className="navbar__nav">
          <NavLink
            to="/blocks"
            className="navbar__nav__item"
            activeClassName="navbar__nav__item_current"
            exact
          >
            Blocks
          </NavLink>
          <NavLink
            to="/transactions"
            className="navbar__nav__item"
            activeClassName="navbar__nav__item_current"
            exact
          >
            Transactions
          </NavLink>
          <NavLink
            to="/mempool"
            className="navbar__nav__item"
            activeClassName="navbar__nav__item_current"
            exact
          >
            Mempool
          </NavLink>
          <NavLink
            to="/peers"
            className="navbar__nav__item"
            activeClassName="navbar__nav__item_current"
            exact
          >
            Peers
          </NavLink>
          <NavLink
            to="/balance"
            className="navbar__nav__item"
            activeClassName="navbar__nav__item_current"
            exact
          >
            Balance
          </NavLink>
        </div>
        <NavBarStatus />
      </section>
    );
  }
}

export default withStyles(s)(NavBar);
