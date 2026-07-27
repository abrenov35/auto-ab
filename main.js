const express = require('express');
const fetch = require('node-fetch');

const app = express();

// Configuration
const GAS_URL = "https://script.google.com/macros/s/AKfycbwLdg8DunFYPdHQ6Ghhu2qwNMyE1aqjqazWi6fIo7qCxfIoFKzeNhgH87Wpb_u029Jx/exec";

// Middleware: Parse JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));

// Middleware: CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'auto-ab-cors-proxy',
    gas_url: GAS_URL.substring(0, 50) + '...'
  });
});

// Proxy ALL requests to GAS
app.all('/*', async (req, res) => {
  try {
    // Determine method: Use POST for loadData, otherwise follow original method
    let method = req.method;
    let body = undefined;
    let gasUrl = GAS_URL;
    
    if (req.path === '/' || req.path === '') {
      // For root requests, check if action=loadData
      const action = req.query.action || (req.body ? req.body.action : '');
      
      if (action === 'loadData') {
        // Use POST for loadData
        method = 'POST';
        body = JSON.stringify({ action: 'loadData' });
      } else {
        // Use query params for GET
        const queryParams = Object.keys(req.query || {})
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(req.query[key])}`)
          .join('&');
        if (queryParams) {
          gasUrl += '?' + queryParams;
        }
      }
    } else {
      // For other paths, use query params
      const queryParams = Object.keys(req.query || {})
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(req.query[key])}`)
        .join('&');
      if (queryParams) {
        gasUrl += '?' + queryParams;
      }
    }

    // Prepare body for POST requests
    if (method === 'POST' || method === 'PUT') {
      if (!body) {
        if (typeof req.body === 'string') {
          body = req.body;
        } else if (typeof req.body === 'object') {
          try {
            body = JSON.stringify(req.body);
          } catch (e) {
            body = req.body;
          }
        }
      }
    }

    // Fetch from GAS with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const gasResponse = await fetch(gasUrl, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'auto-ab-cors-proxy/1.0'
      },
      body: body,
      signal: controller.signal
    });

    clearTimeout(timeout);

    // Get response text
    const responseText = await gasResponse.text();

    // Return with CORS headers
    res.status(gasResponse.status);
    res.send(responseText);

  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(503).json({ 
      error: 'Service temporarily unavailable',
      message: error.message,
      service: 'auto-ab-cors-proxy'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Auto-AB CORS Proxy v1.0`);
  console.log(`📍 Listening on port ${PORT}`);
  console.log(`🔗 GAS Backend: ${GAS_URL.substring(0, 60)}...`);
  console.log(`📡 CORS: Enabled for all origins`);
});
