const queryString = require('querystring');
const express = require('express');
const session = require('express-session');
const request = require('request');
const createApiClient = require('sipgate-rest-api-client').default;

// sipgate REST API settings
const apiUrl = 'https://api.sipgate.com/v1';
const desiredScope = 'all';
const clientId = process.env.npm_config_client_id;
const clientSecret = process.env.npm_config_client_secret;

if (!clientId || clientId === 'CLIENT_ID' || !clientSecret || clientSecret === 'CLIENT_SECRET') {
  console.log('Please provide a client id and secret in this project .npmrc file.');
  process.exit(1);
}

// URL constants
const port = process.env.npm_config_port;
const appUrl = `http://localhost:${port}`;
const authPath = '/authorize';
const authRedirectUrl = `${appUrl}${authPath}`;
const apiAuthUrl = `${apiUrl}/authorization/oauth/authorize?` + queryString.stringify({
    client_id: clientId,
    redirect_uri: authRedirectUrl,
    scope: desiredScope,
    response_type: 'code',
  });
const tokenUrl = `${apiUrl}/authorization/oauth/token`;

// Initialize express app
const app = express();
app.use(session({
  secret: 'sipgate-rest-api-demo',
  cookie: { maxAge: 60000 }
}));

app.get('/', function (req, res) {
  const accessToken = req.session['accessToken'];
  if (!accessToken) {
    res.redirect(authPath);
    return;
  }

  const apiClient = createApiClient(apiUrl, accessToken);
  apiClient.getUserInfo()
    .then(function (response) {
      res.send(`<code><pre>${JSON.stringify(response, null, 2)}</pre></code>`);
    })
    .catch(function(reason) {
      if (reason === 'Unauthorized') {
        res.redirect(authPath);
        return;
      }
      res.send('Sorry, something went wrong. Please try again.');
    });
});

app.get(authPath, function (req, res) {
  const authorizationCode = req.query.code;

  if (!authorizationCode) {
    res.redirect(apiAuthUrl);
    return;
  }

  request({
      url: tokenUrl,
      method: "POST",
      form: {
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        redirect_uri: authRedirectUrl,
        grant_type: 'authorization_code',
      },
    },
    function (error, response, body) {
      if (error && response.statusCode !== 200) {
        res.redirect(apiAuthUrl);
        return;
      }

      const responseBody = JSON.parse(body);
      if (!('access_token' in responseBody)) {
        res.redirect(apiAuthUrl);
        return;
      }

      req.session['accessToken'] = responseBody['access_token'];
      res.redirect('/');
    }
  );
});

app.listen(port, function () {
  console.log(`Listening on port ${port}. Open ${appUrl} in your browser.`);
});