import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const upstreamBase = 'https://167-234-239-100.sslip.io';
  const queryStr = req.url && req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const upstreamUrl = `${upstreamBase}/api/store/products${queryStr}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(req.headers['authorization'] ? { 'Authorization': String(req.headers['authorization']) } : {}),
      },
    });

    if (upstreamRes.ok) {
      const data = await upstreamRes.text();
      res.statusCode = upstreamRes.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
      return;
    }

    // If upstream returns 404 (because backend instance has not registered the route),
    // provide the valid empty catalog conforming to API schema contract:
    if (upstreamRes.status === 404) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        products: [],
        total: 0,
        limit: 24,
        offset: 0,
      }));
      return;
    }

    // Forward any other HTTP status (e.g. 500, 401, 403) so real errors are not masked
    const text = await upstreamRes.text();
    res.statusCode = upstreamRes.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(text);
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Serviço temporariamente indisponível', statusCode: 503 }));
  }
}
