const express = require('express');
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;

const oauth = OAuth({
  consumer: { key: consumerKey, secret: consumerSecret },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  }
});

let oauthToken = '';
let oauthTokenSecret = '';

// Endpoint to get the request token and redirect the user to Garmin's authorization URL
app.post('/request_token', async (req, res) => {
  const request_data = {
    url: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
    method: 'POST'
  };
  const headers = oauth.toHeader(oauth.authorize(request_data));

  try {
    const response = await axios.post(request_data.url, null, { headers });
    const responseData = querystring.parse(response.data);
    oauthToken = responseData.oauth_token;
    oauthTokenSecret = responseData.oauth_token_secret;

    // Redirect user to Garmin's authorization URL
    const authorizationUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${oauthToken}`;
    console.log("authorizationUrl",authorizationUrl)
    res.redirect(authorizationUrl);
  } catch (error) {
    res.status(error.response ? error.response.status : 500).json({ error: error.message });
  }
});

// Callback URL to handle the Garmin authorization and exchange for an access token
app.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const request_data = {
    url: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    method: 'POST',
    data: { oauth_verifier }
  };

  const headers = oauth.toHeader(oauth.authorize(request_data, {
    key: oauth_token,
    secret: oauthTokenSecret
  }));

  try {
    const response = await axios.post(request_data.url, null, { headers });
    const responseData = querystring.parse(response.data);
    // Store the access token and secret for later use
    const accessToken = responseData.oauth_token;
    const accessTokenSecret = responseData.oauth_token_secret;

    // Respond with the access token and secret
    res.json({ accessToken, accessTokenSecret });
  } catch (error) {
    res.status(error.response ? error.response.status : 500).json({ error: error.message });
  }
});

app.get('/api/step-count', async (req, res) => {
    const accessToken = req.query.access_token;

    if (!accessToken) {
        return res.status(400).send('Access token is required');
    }

    try {
        const response = await axios.get('https://apis.garmin.com/wellness-api/rest/activities', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching step count:', error.response?.data || error.message);
        res.status(500).send('Error fetching step count');
    }
});

// POST endpoint to print query parameters and body
app.post('/debug', (req, res) => {
    // Log query parameters
    console.log('Query Parameters:', req?.query ?? "null");
  
    // Log request body
    console.log('Request Body:', req?.body ?? null);
  
    res.json({
      message: 'Data received',
      query: req.query,
      body: req.body
    });
  });

// Endpoint to set up the webhook for real-time data updates
app.post('/setup_webhook', async (req, res) => {
  const accessToken = req.body.accessToken;
  const accessTokenSecret = req.body.accessTokenSecret;
  const callbackUrl = 'YOUR_WEBHOOK_CALLBACK_URL';

  const request_data = {
    url: 'https://connectapi.garmin.com/oauth-service/oauth/user/WEBHOOK_SUBSCRIPTION_URL',
    method: 'POST',
    data: { callbackUrl }
  };

  const headers = oauth.toHeader(oauth.authorize(request_data, {
    key: accessToken,
    secret: accessTokenSecret
  }));

  try {
    const response = await axios.post(request_data.url, null, { headers });
    res.json(response.data);
  } catch (error) {
    res.status(error.response ? error.response.status : 500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

//lt --port 3000
//https://github.com/localtunnel/localtunnel