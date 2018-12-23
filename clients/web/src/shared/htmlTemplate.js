import serialize from 'serialize-javascript';

const htmlTemplate = (html, data, style) => {
  return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Test App</title>
            <link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet">
            <style>
                body{
                    margin: 0;
                    font-family: 'Roboto', sans-serif;
                }
            </style>
            <style  id="server-side-styles" type="text/css">${[...style].join(
              ''
            )}</style>
        </head>
        
        <body>
            <div id="app">${html}</div>
            <script>window.__PRELOADED_STATE__ = ${serialize(data)}</script>
            <script src="/bundle.js"></script>
        </body>
        </html>
    `;
};

export default htmlTemplate;
