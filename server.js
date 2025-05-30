const express = require('express');
const connectDB = require('./db/connect');
const waitlistRoutes = require('./routes/waitlist');
const https = require('https');
const querystring = require('querystring');

connectDB();


const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/oauth2callback';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;


const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

//to make HTTPS requests (getAccessToken and sendEmail)
const makeHttpsRequest = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
};

// to get a new access token using the refresh token
async function getAccessToken() {
  const postData = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const { data } = await makeHttpsRequest(options, postData);

  if (data.access_token) {
    return data.access_token;
  } else {
    throw new Error('Failed to obtain access token: ' + JSON.stringify(data));
  }
}

// to send an email using the Gmail API
async function sendEmail(accessToken, formDetails) {
  const { name, email, useCase, discoverySource } = formDetails;
  const emailContent = [
    `From: "NeoMCP AI" <poojithakomakula21@gmail.com>`, 
    `To: komakula30@gmail.com`,
    `Subject: New Message from NeoMCP AI`,
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Use Case: ${useCase}`,
    `Discovery Source: ${discoverySource}`,
  ].join('\n');

  const rawMessage = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const postData = JSON.stringify({
    raw: rawMessage,
  });

  const options = {
    hostname: 'gmail.googleapis.com',
    path: '/gmail/v1/users/me/messages/send',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const { statusCode, data } = await makeHttpsRequest(options, postData);

  console.log('Gmail API response:', statusCode, data);
  if (statusCode === 200) {
    return 'Email sent successfully';
  } else {
    throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
  }
}

// Route to handle OAuth callback (for obtaining the refresh token initially)
app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('No code provided');
    }

    const postData = querystring.stringify({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const { data } = await makeHttpsRequest(options, postData);

    if (data.refresh_token) {
      res.status(200).send(`Refresh Token: ${data.refresh_token}\nPlease store this securely and update REFRESH_TOKEN in the code.`);
    } else {
      res.status(400).send('Failed to obtain refresh token: ' + JSON.stringify(data));
    }
  } catch (error) {
    res.status(500).send('Error during OAuth: ' + error.message);
  }
});

// Route to handle email sending
app.post('/send-email', async (req, res) => {
  try {
    const formDetails = req.body;
    if (!formDetails.name || !formDetails.email || !formDetails.useCase || !formDetails.discoverySource) {
      return res.status(400).send('Missing required fields');
    }

    const accessToken = await getAccessToken();
    const result = await sendEmail(accessToken, formDetails);
    res.status(200).send(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error sending email: ' + error.message);
  }
});

app.use('/', waitlistRoutes);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `response_type=code&` +
    `scope=https://www.googleapis.com/auth/gmail.send&` +
    `access_type=offline&` +
    `prompt=consent`;
  console.log('Visit this URL to authorize the app and get the refresh token:');
  console.log(authUrl);
});