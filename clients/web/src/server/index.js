import express from 'express';
import cors from 'cors';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, matchPath } from 'react-router-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import ReduxThunk from 'redux-thunk';

import htmlTemplate from '../shared/htmlTemplate';
import App from '../shared/App';
import StyleProvider from '../shared/StyleProvider.js';
import config from '../../config';
import reduser from '../shared/redusers';

const app = express();

app.use(cors());

app.use(express.static('dist'));

app.get('*', async (req, res) => {
  const context = {};
  const store = createStore(reduser, applyMiddleware(ReduxThunk));
  const css = new Set();
  const stylesheet = {
    insertCss: (...styles) => styles.forEach(style => css.add(style._getCss())),
  };

  const markup = renderToString(
    <Provider store={store}>
      <StaticRouter location={req.url} context={context}>
        <StyleProvider context={stylesheet}>
          <App />
        </StyleProvider>
      </StaticRouter>
    </Provider>
  );

  const finalState = store.getState();

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(htmlTemplate(markup, finalState, css));
});

app.listen(config.port, () => {
  console.log(`app started on port ${config.port}`);
});
