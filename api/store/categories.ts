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
  const upstreamUrl = `${upstreamBase}/api/store/categories${queryStr}`;

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
          { id: 'cat-bots', name: 'Bots & Integrações', slug: 'bots', description: 'Bots para espaços, webhooks e automações', icon: 'Bot', sortOrder: 1 },
          { id: 'cat-servicos', name: 'Serviços & Design', slug: 'servicos', description: 'Configuração de espaços, moderação e identidade visual', icon: 'Sparkles', sortOrder: 2 },
          { id: 'cat-arte', name: 'Arte & Emojis', slug: 'arte', description: 'Pacotes de emojis, ícones, banners e ilustrações', icon: 'Palette', sortOrder: 3 },
          { id: 'cat-templates', name: 'Comunidades & Modelos', slug: 'templates', description: 'Modelos prontos de canais, cargos e permissões', icon: 'LayoutTemplate', sortOrder: 4 },
          { id: 'cat-conteudo', name: 'Cursos & Conteúdo', slug: 'conteudo', description: 'Guias, mentorias e e-books exclusivos', icon: 'GraduationCap', sortOrder: 5 },
          { id: 'cat-outros', name: 'Outros', slug: 'outros', description: 'Outros produtos e utilitários', icon: 'Package', sortOrder: 6 },
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
