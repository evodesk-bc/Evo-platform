import React from 'react';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Header.css';

class Header extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <section className="header">
        <h1 className="header__title">{this.props.title}</h1>
      </section>
    );
  }
}

export default withStyles(s)(Header);
