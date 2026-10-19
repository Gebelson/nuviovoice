import type { FastifyInstance } from 'fastify';

interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

export interface DownloadInfoResponse {
  available: boolean;
  version?: string;
  fileName?: string;
  size?: number;
  downloadUrl?: string;
  releaseDate?: string;
  message?: string;
}

const GITHUB_REPO = 'Gebelson/nuviovoice';
const CACHE_TTL_MS = 60_000;

let cachedInfo: DownloadInfoResponse | null = null;
let cacheExpiresAt = 0;

export async function fetchLatestWindowsRelease(): Promise<DownloadInfoResponse> {
  const now = Date.now();
  if (cachedInfo && now < cacheExpiresAt) {
    return cachedInfo;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
      headers: {
        'User-Agent': 'Nuvio-Server',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      // Fallback: if cached exists (even expired), return it; otherwise unavailable
      if (cachedInfo) return cachedInfo;
      return {
        available: false,
        message: 'O Nuvio para Windows estará disponível em breve.',
      };
    }

    const releases = (await res.json()) as GitHubRelease[];
    // Find latest published, non-draft, non-prerelease release
    const validReleases = releases.filter((r) => !r.draft && !r.prerelease);

    for (const rel of validReleases) {
      const windowsAsset = rel.assets.find(
        (a) => a.name.endsWith('.exe') && (a.name.includes('Nuvio') || a.name.includes('Setup')),
      ) ?? rel.assets.find((a) => a.name.endsWith('.exe'));

      if (windowsAsset) {
        cachedInfo = {
          available: true,
          version: rel.tag_name.replace(/^v/, ''),
          fileName: windowsAsset.name,
          size: windowsAsset.size,
          downloadUrl: windowsAsset.browser_download_url,
          releaseDate: rel.published_at,
        };
        cacheExpiresAt = now + CACHE_TTL_MS;
        return cachedInfo;
      }
    }

    cachedInfo = {
      available: false,
      message: 'O Nuvio para Windows estará disponível em breve.',
    };
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedInfo;
  } catch (err) {
    if (cachedInfo) return cachedInfo;
    return {
      available: false,
      message: 'O Nuvio para Windows estará disponível em breve.',
    };
  }
}

export async function downloadRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/download/info', async (_request, reply) => {
    const info = await fetchLatestWindowsRelease();
    return reply.code(200).send(info);
  });

  app.get('/api/download/windows', async (_request, reply) => {
    const info = await fetchLatestWindowsRelease();

    if (!info.available || !info.downloadUrl) {
      return reply.code(404).send({
        error: 'not_found',
        message: info.message || 'O Nuvio para Windows estará disponível em breve.',
      });
    }

    return reply.redirect(info.downloadUrl, 302);
  });
}
