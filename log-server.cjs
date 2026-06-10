const http = require('http');
const https = require('https');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Handle CORS preflight for all endpoints
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    return res.end();
  }

  // Logger endpoint
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/log') {
    if (parsedUrl.query.log) {
      console.log(parsedUrl.query.log);
    }
    
    // Return a transparent 1x1 pixel image
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Access-Control-Allow-Origin': '*'
    });
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return res.end(pixel);
  }

  // Proxy endpoint
  if (parsedUrl.pathname === '/proxy') {
    const targetUrlStr = parsedUrl.query.url;
    if (!targetUrlStr) {
      res.writeHead(400);
      return res.end('Missing URL parameter');
    }

    try {
      const targetUrl = new URL(targetUrlStr);
      const isHttps = targetUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      // Copy headers, but remove restricted ones
      const headers = { ...req.headers };
      delete headers['host'];
      delete headers['origin'];
      delete headers['referer'];
      // Sometimes accept-encoding can mess up proxy responses if we don't decode them,
      // so we remove it and let Node fetch it transparently.
      delete headers['accept-encoding']; 

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: headers
      };

      const proxyReq = client.request(options, (proxyRes) => {
        // Prepare response headers, appending CORS
        const responseHeaders = { ...proxyRes.headers };
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        
        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (e) => {
        console.error(`[Proxy Error] ${e.message}`);
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
        res.end(`Proxy Error: ${e.message}`);
      });

      // Pipe request body to proxy request
      req.pipe(proxyReq, { end: true });
    } catch (error) {
      console.error(`[Proxy Error] Invalid URL: ${targetUrlStr}`);
      res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
      return res.end('Invalid URL');
    }
    return;
  }

  // Not found
  res.writeHead(404);
  res.end('Not Found');
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[YTAF Remote Logger + Proxy] Listening on http://0.0.0.0:${PORT}`);
});
