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
  const upstreamUrl = `${upstreamBase}/api/bots/categories${queryStr}`;

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

    if (upstreamRes.status === 404) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        categories: [
          { id: 'bcat_mod', name: 'Moderação', slug: 'moderacao', description: 'Proteja seus espaços com moderação automática e ferramentas de segurança.', icon: 'Shield', sortOrder: 1 },
          { id: 'bcat_music', name: 'Música', slug: 'musica', description: 'Ouça músicas em alta fidelidade e gerencie playlists com sua comunidade.', icon: 'Music', sortOrder: 2 },
          { id: 'bcat_fun', name: 'Entretenimento', slug: 'entretenimento', description: 'Memes, minijogos e diversão garantida para os membros.', icon: 'Sparkles', sortOrder: 3 },
          { id: 'bcat_games', name: 'Jogos', slug: 'jogos', description: 'Integrações com games populares, estatísticas e partidas multiplayer.', icon: 'Gamepad2', sortOrder: 4 },
          { id: 'bcat_eco', name: 'Economia', slug: 'economia', description: 'Sistemas de moedas, lojas virtuais, inventários e transações.', icon: 'Coins', sortOrder: 5 },
        ],
      }));
      return;
    }

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
