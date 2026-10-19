import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { downloadRoutes } from './download.js';

describe('downloadRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.restoreAllMocks();
    app = Fastify();
    await app.register(downloadRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/download/info returns 200 with available release info when GitHub has release', async () => {
    const mockReleases = [
      {
        id: 416854979,
        tag_name: 'v1.12.0',
        name: 'Nuvio Desktop v1.12.0',
        draft: false,
        prerelease: false,
        published_at: '2026-10-19T04:38:35Z',
        assets: [
          {
            name: 'Nuvio-Setup.exe',
            size: 110769871,
            browser_download_url: 'https://github.com/Gebelson/nuviovoice/releases/download/v1.12.0/Nuvio-Setup.exe',
            content_type: 'application/octet-stream',
          },
        ],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockReleases,
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/download/info',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.available).toBe(true);
    expect(body.version).toBe('1.12.0');
    expect(body.fileName).toBe('Nuvio-Setup.exe');
    expect(body.downloadUrl).toContain('Nuvio-Setup.exe');
  });

  it('GET /api/download/windows redirects (302) to real installer download URL', async () => {
    const mockReleases = [
      {
        id: 416854979,
        tag_name: 'v1.12.0',
        name: 'Nuvio Desktop v1.12.0',
        draft: false,
        prerelease: false,
        published_at: '2026-10-19T04:38:35Z',
        assets: [
          {
            name: 'Nuvio-Setup.exe',
            size: 110769871,
            browser_download_url: 'https://github.com/Gebelson/nuviovoice/releases/download/v1.12.0/Nuvio-Setup.exe',
            content_type: 'application/octet-stream',
          },
        ],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockReleases,
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/download/windows',
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://github.com/Gebelson/nuviovoice/releases/download/v1.12.0/Nuvio-Setup.exe');
  });
});
