const express = require('express');
const fetch = require('node-fetch');

const app = express();

// Configuration
const GAS_URL = "https://script.google.com/macros/s/AKfycbwG__1dk5qAN9axbr3q6NzN0MqaaHeDJJOPUUcs599FGDtYTgE3BkwUep-VF0fQQMyY/exec";

// Middleware: Parse JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

// Middleware: CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auto-ab-proxy' });
});

// Proxy ALL requests to GAS
app.all('/*', async (req, res) => {
  try {
    // Build GAS URL with query params
    let gasUrl = GAS_URL;
    const queryString = Object.keys(req.query)
      .map(key => `${key}=${encodeURIComponent(req.query[key])}`)
      .join('&');
    
    if (queryString) {
      gasUrl += '?' + queryString;
    }

    // Prepare body
    let body = undefined;
    if (req.method === 'POST' || req.method === 'PUT') {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      }
    }

    // Fetch from GAS
    const gasResponse = await fetch(gasUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });

    // Get response text
    const responseText = await gasResponse.text();

    // Return with CORS headers
    res.status(gasResponse.status);
    res.header('Content-Type', 'application/json');
    res.send(responseText);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: error.message,
      service: 'auto-ab-proxy'
    });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Auto-AB Proxy listening on port ${PORT}`);
  console.log(`📍 GAS URL: ${GAS_URL}`);
});
