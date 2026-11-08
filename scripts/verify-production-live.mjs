import https from 'node:https';

const BACKEND_URL = process.env.BACKEND_URL || 'https://167-234-239-100.sslip.io';
const VERCEL_URL = process.env.VERCEL_URL || 'https://nuviovoice.vercel.app';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

function request(baseUrl, path, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl + path);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };
    if (AUTH_TOKEN && !reqOptions.headers['Authorization']) {
      reqOptions.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const req = https.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = body;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message });
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function verify() {
  console.log('====================================================');
  console.log(`Verificando Backend: ${BACKEND_URL}`);
  console.log(`Verificando Vercel:  ${VERCEL_URL}`);
  console.log('====================================================\n');

  // 1. Health
  const health = await request(BACKEND_URL, '/api/health');
  console.log(`1. /api/health -> Status: ${health.status} (Esperado: 200)`);

  // 2. Instance Info
  const info = await request(BACKEND_URL, '/api/instance/info');
  console.log(`2. /api/instance/info -> Status: ${info.status}`);
  console.log(`   Versão reportada: ${info.data?.version || 'N/A'}`);
  console.log(`   Commit compilado: ${info.data?.commit || 'N/A'}`);

  // 3. Live Streams (Public)
  const streams = await request(BACKEND_URL, '/api/live/streams');
  console.log(`3. /api/live/streams -> Status: ${streams.status} (Esperado: 200)`);
  if (streams.status === 200) {
    console.log(`   Transmissões ativas: ${Array.isArray(streams.data?.streams) ? streams.data.streams.length : 0}`);
  } else {
    console.log(`   Resposta: ${JSON.stringify(streams.data)}`);
  }

  // 4. Live Channels Me (No Auth)
  const meNoAuth = await request(BACKEND_URL, '/api/live/channels/me', { headers: { 'Authorization': '' } });
  console.log(`4. /api/live/channels/me (sem token) -> Status: ${meNoAuth.status} (Esperado: 401 se rota existir, 404 se desatualizado)`);

  // 5. Live Channels Me (With Auth if available)
  if (AUTH_TOKEN) {
    const meAuth = await request(BACKEND_URL, '/api/live/channels/me');
    console.log(`5. /api/live/channels/me (com token) -> Status: ${meAuth.status} (Esperado: 200)`);
    console.log(`   Canais vinculados: ${JSON.stringify(meAuth.data)}`);
  }

  // 6. Vercel Streams
  const vercelStreams = await request(VERCEL_URL, '/api/live/streams');
  console.log(`6. Vercel /api/live/streams -> Status: ${vercelStreams.status} (Esperado: 200, Sem 503)`);

  console.log('\n====================================================');
}

verify();
