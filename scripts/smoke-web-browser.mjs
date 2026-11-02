import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../packages/web/dist');

if (!fs.existsSync(distDir)) {
  console.error('[Smoke Test] packages/web/dist não encontrado. Execute pnpm build:web antes.');
  process.exit(1);
}

// Find playwright in zapitv or local node_modules
let playwright = null;
const possiblePlaywrightPaths = [
  'playwright',
  'F:/Codex/zapitv-vercel-build-fix/node_modules/playwright/index.mjs',
  'C:/Users/gebel/Documents/Codex/zapitv-vercel-build-fix/node_modules/playwright/index.mjs',
];

for (const p of possiblePlaywrightPaths) {
  try {
    const targetUrl = p.startsWith('/') || p.includes(':/') ? pathToFileURL(p).href : p;
    const mod = await import(targetUrl);
    playwright = mod.chromium ? mod : (mod.default?.chromium ? mod.default : null);
    if (playwright) break;
  } catch (err) {}
}

if (!playwright) {
  console.error('[Smoke Test] Playwright não foi encontrado para execução headless.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

// Static server mimicking Vercel's SPA rules (assets return 404 if missing, SPA routes fallback to index.html)
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(distDir, pathname);

  // If file exists, serve it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // If path is under /assets/ or has a file extension and does NOT exist, return 404 (do not fallback)
  if (pathname.startsWith('/assets/') || path.extname(pathname) !== '') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Asset not found', path: pathname }));
    return;
  }

  // SPA navigation fallback to index.html
  const indexPath = path.join(distDir, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(indexPath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
console.log(`[Smoke Test] Servidor estático ativo em ${baseUrl}`);

let browser = null;
let passed = true;

try {
  browser = await playwright.chromium.launch({ headless: true });

  // Scenario 1: Clean Unauthenticated Load (Must render LoginPage, not black screen)
  console.log('\n[Cenário 1] Testando carregamento sem sessão (Página de Login)...');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    const rootHtml = await page.$eval('#root', el => el.innerHTML);
    const hasLoginCard = await page.$('.bg-surface-elevated, form, input[type="text"]');
    const rootVisible = await page.$eval('#root', el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (errors.length > 0) {
      console.error('❌ Erros de página detectados:', errors);
      passed = false;
    } else if (!rootVisible || rootHtml.length < 50 || !hasLoginCard) {
      console.error('❌ Falha: A interface permaneceu vazia ou não renderizou o card de login!');
      passed = false;
    } else {
      console.log('✓ [Cenário 1] Passou: Login renderizado com sucesso sem tela preta.');
    }
    await page.close();
  }

  // Scenario 2: Authenticated Session Load (Must mount AppLayout)
  console.log('\n[Cenário 2] Testando carregamento com sessão autenticada...');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // Inject token
    await page.addInitScript(() => {
      localStorage.setItem('backspace_token', 'test_smoke_token');
    });

    await page.goto(`${baseUrl}/channels/@me`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    const rootHtml = await page.$eval('#root', el => el.innerHTML);
    if (errors.length > 0) {
      console.error('❌ Erros de página detectados:', errors);
      passed = false;
    } else if (rootHtml.length < 50) {
      console.error('❌ Falha: Interface ficou vazia após navegação autenticada!');
      passed = false;
    } else {
      console.log('✓ [Cenário 2] Passou: Interface ou esqueleto montado com sucesso.');
    }
    await page.close();
  }

  // Scenario 3: Watchdog Fallback Verification (Simulates main chunk load failure)
  console.log('\n[Cenário 3] Validando ativação do Fallback de Recuperação sob falha fatal de script...');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    // Abort main script chunk to simulate chunk 404 or network outage
    await page.route('**/assets/index-*.js', route => route.abort());

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const fallbackVisible = await page.$eval('#nuvio-boot-fallback', el => {
      const style = window.getComputedStyle(el);
      return style.display === 'flex';
    }).catch(() => false);

    const msg = await page.$eval('#nuvio-fallback-msg', el => el.textContent).catch(() => '');

    if (!fallbackVisible) {
      console.error('❌ Falha: O fallback de recuperação não se tornou visível após falha no script principal!');
      passed = false;
    } else {
      console.log('✓ [Cenário 3] Passou: Fallback ativado com sucesso após bloqueio do bundle:', msg);
    }
    await page.close();
  }

} catch (err) {
  console.error('[Smoke Test] Erro fatal durante os testes:', err);
  passed = false;
} finally {
  if (browser) await browser.close();
  server.close();
}

if (!passed) {
  console.error('\n❌ O smoke test do Nuvio FALHOU.');
  process.exit(1);
} else {
  console.log('\n======================================================');
  console.log('✓✓✓ TODOS OS TESTES DE SMOKE BROWSER DO NUVIO PASSARAM! ✓✓✓');
  console.log('======================================================');
  process.exit(0);
}
