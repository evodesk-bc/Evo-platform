import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import ReduxThunk from 'redux-thunk';
import { Provider } from 'react-redux';

import reduser from '../shared/redusers';

import App from '../shared/App';
import StyleProvider from '../shared/StyleProvider';

const context = {
  insertCss: (...styles) => {
    const removeCss = styles.map(x => x._insertCss());
    return () => {
      removeCss.forEach(f => f());
    };
  },
};

const preloadedState = window.__PRELOADED_STATE__;

delete window.__PRELOADED_STATE__;

const store = createStore(
  reduser,
  preloadedState,
  compose(applyMiddleware(ReduxThunk))
);

const app = document.getElementById('app');
ReactDOM.hydrate(
  <Provider store={store}>
    <BrowserRouter>
      <StyleProvider context={context}>
        <App />
      </StyleProvider>
    </BrowserRouter>
  </Provider>,
  app,
  () => {
    const ssStyles = document.getElementById('server-side-styles');
    ssStyles.parentNode.removeChild(ssStyles);
  }
);
