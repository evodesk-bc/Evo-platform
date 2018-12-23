import React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import routes from './routes';

import Header from './components/Header/Header';
import NavBar from './components/NavBar/NavBar';

import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from 'react-virtualized/styles.css';

class App extends React.Component {
  render() {
    return (
      <React.Fragment>
        <Header title="Evodesk Block Explorer" />
        <NavBar />
        <Switch>
          <Redirect from="/" to="/blocks" exact />
          {routes.map(({ path, exact, component: Component, ...rest }) => (
            <Route
              key={path}
              path={path}
              exact={exact}
              render={props => <Component {...props} {...rest} />}
            />
          ))}
        </Switch>
      </React.Fragment>
    );
  }
}

export default withStyles(s)(App);
