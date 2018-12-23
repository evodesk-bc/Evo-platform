import React from 'react';
import PropTypes from 'prop-types';
import App from './App';

class StyleProvider extends React.Component {
  static childContextTypes = {
    insertCss: PropTypes.func,
  };

  getChildContext() {
    return { ...this.props.context };
  }

  render() {
    return <App {...this.props} />;
  }
}

export default StyleProvider;
