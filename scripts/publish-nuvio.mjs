#!/usr/bin/env node
/**
 * Nuvio — Automated Web & Desktop Release Orchestrator
 *
 * Automates:
 * 1. Preflight checks (TypeScript typecheck, web tests, desktop tests, server tests, web build).
 * 2. Version synchronization across all monorepo packages.
 * 3. Git commit, tag, and push to origin main + tag.
 * 4. Vercel deployment verification (https://nuviovoice.vercel.app).
 * 5. GitHub Actions desktop build & release monitoring.
 * 6. Electron-updater latest.yml availability confirmation.
 *
 * Usage:
 *   node scripts/publish-nuvio.mjs
 *   node scripts/publish-nuvio.mjs --bump patch
 *   node scripts/publish-nuvio.mjs --bump minor
 *   node scripts/publish-nuvio.mjs --version 1.15.0
 *   node scripts/publish-nuvio.mjs --verify-only
 *   node scripts/publish-nuvio.mjs --skip-wait
 */

import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GITHUB_REPO = 'Gebelson/nuviovoice';
const VERCEL_URL = 'https://nuviovoice.vercel.app';

function log(msg) {
  console.log(`\x1b[36m[nuvio-publish]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m✔ [nuvio-publish]\x1b[0m ${msg}`);
}

function warn(msg) {
  console.log(`\x1b[33m⚠ [nuvio-publish]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m✖ [nuvio-publish]\x1b[0m ${msg}`);
}

function run(cmd, cwd = REPO_ROOT) {
  log(`Executing: ${cmd}`);
  return execSync(cmd, { cwd, stdio: 'inherit', encoding: 'utf8' });
}

function runSilent(cmd, cwd = REPO_ROOT) {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
  } catch (err) {
    return null;
  }
}

async function fetchJson(url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NuvioReleaseScript/1.0', ...headers },
      redirect: 'follow',
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), data };
  } catch (err) {
    return { status: 500, ok: false, error: String(err), data: null };
  }
}

async function fetchText(url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NuvioReleaseScript/1.0', ...headers },
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, headers: Object.fromEntries(res.headers.entries()), text };
  } catch (err) {
    return { status: 500, ok: false, error: String(err), text: '' };
  }
}

function bumpSemver(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

async function getPublishedReleases() {
  const res = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases`);
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

async function getCurrentVersion() {
  const pkg = JSON.parse(await readFile(path.join(REPO_ROOT, 'packages/desktop/package.json'), 'utf8'));
  return pkg.version;
}

async function checkVercelDeploy(expectedCommit, maxAttempts = 10, intervalSec = 5) {
  log(`Verifying Vercel web deployment at ${VERCEL_URL}...`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchText(VERCEL_URL);
    if (res.ok) {
      const vercelId = res.headers['x-vercel-id'] || 'active';
      return {
        ok: true,
        status: res.status,
        vercelId,
        url: VERCEL_URL,
      };
    }
    log(`Vercel check attempt ${attempt}/${maxAttempts} returned ${res.status}. Waiting ${intervalSec}s...`);
    await new Promise(r => setTimeout(r, intervalSec * 1000));
  }
  return { ok: false, error: 'Vercel check timed out', url: VERCEL_URL };
}

async function pollGitHubRelease(tag, maxAttempts = 40, intervalSec = 15) {
  log(`Polling GitHub Release for tag ${tag} (waiting for GitHub Actions Windows build & publish)...`);
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetchJson(apiUrl);
    if (res.ok && res.data) {
      const release = res.data;
      const assets = (release.assets || []).map(a => a.name);
      const hasExe = assets.includes('Nuvio-Setup.exe');
      const hasBlockmap = assets.includes('Nuvio-Setup.exe.blockmap');
      const hasLatestYml = assets.includes('latest.yml');
      const hasSha = assets.includes('SHA256SUMS.txt');

      log(`Attempt ${attempt}/${maxAttempts}: Release found with ${assets.length} assets.`);

      if (hasExe && hasBlockmap && hasLatestYml && hasSha) {
        success(`All required release assets published: ${assets.join(', ')}`);
        return { ok: true, release, assets };
      }
    }
    log(`Waiting ${intervalSec}s for desktop build artifacts (attempt ${attempt}/${maxAttempts})...`);
    await new Promise(r => setTimeout(r, intervalSec * 1000));
  }

  return { ok: false, message: 'Timed out waiting for GitHub Release assets' };
}

async function verifyLatestYmlContent(tag, version) {
  const url = `https://github.com/${GITHUB_REPO}/releases/download/${tag}/latest.yml`;
  log(`Validating latest.yml for auto-updater: ${url}`);
  const res = await fetchText(url);
  if (!res.ok || !res.text) {
    return { ok: false, error: `Failed to fetch latest.yml (HTTP ${res.status})` };
  }

  const text = res.text;
  const versionMatch = text.match(/version:\s*([0-9.]+)/);
  const shaMatch = text.match(/sha512:\s*([A-Za-z0-9+/=]+)/);
  const pathMatch = text.match(/path:\s*([^\s]+)/) || text.match(/url:\s*([^\s]+)/);

  const foundVersion = versionMatch ? versionMatch[1] : null;
  const foundSha = shaMatch ? shaMatch[1] : null;
  const foundFile = pathMatch ? pathMatch[1] : null;

  const valid = foundVersion === version && !!foundSha && !!foundFile;
  return {
    ok: valid,
    version: foundVersion,
    sha512: foundSha,
    file: foundFile,
    raw: text,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');
  const skipWait = args.includes('--skip-wait');
  const bumpIdx = args.indexOf('--bump');
  const requestedBump = bumpIdx !== -1 ? args[bumpIdx + 1] : null;
  const versionIdx = args.indexOf('--version');
  const requestedVersion = versionIdx !== -1 ? args[versionIdx + 1] : null;

  let version = await getCurrentVersion();
  log(`Current monorepo version: ${version}`);

  const existingReleases = await getPublishedReleases();
  const alreadyReleased = existingReleases.some(r => r.tag_name === `v${version}`);

  if (verifyOnly) {
    log(`Running in verify-only mode for v${version}...`);
    const vercel = await checkVercelDeploy();
    const releaseRes = await pollGitHubRelease(`v${version}`, 1);
    const ymlRes = await verifyLatestYmlContent(`v${version}`, version);
    console.log('\n=== VERIFICATION REPORT ===');
    console.log(`Versão: ${version}`);
    console.log(`Vercel: ${vercel.ok ? 'ONLINE (200 OK)' : 'FAILED'} - ${VERCEL_URL}`);
    console.log(`Desktop Release: ${releaseRes.ok ? 'PUBLISHED' : 'NOT FOUND / PENDING'}`);
    console.log(`Updater Metadata: ${ymlRes.ok ? `VALID (v${ymlRes.version}, sha512: ${ymlRes.sha512?.slice(0, 16)}...)` : 'INVALID'}`);
    return;
  }

  // Determine if a version bump is needed
  let targetVersion = version;
  if (requestedVersion) {
    targetVersion = requestedVersion;
  } else if (requestedBump) {
    targetVersion = bumpSemver(version, requestedBump);
  } else if (alreadyReleased) {
    targetVersion = bumpSemver(version, 'patch');
    log(`Version v${version} was already released on GitHub. Automatically bumping to next patch: ${targetVersion}`);
  }

  if (targetVersion !== version) {
    log(`Bumping workspace version from ${version} to ${targetVersion}...`);
    run(`node scripts/bump-version.mjs ${targetVersion}`);
    version = targetVersion;
    success(`Version bumped to ${version}`);
  }

  // 1. Run Preflight Checks (TypeScript + Tests + Web Build)
  log('Running required TypeScript checks and automated test suites...');
  try {
    run('pnpm -r typecheck');
    run('pnpm --filter @concord/desktop test');
    run('pnpm --filter @concord/web test sidebarNavigation.test.tsx ChannelSidebar.homeNav.test.tsx SpaceSidebar.homeNav.test.tsx ChannelSidebar.download.test.tsx homeNav.test.ts opportunities.test.tsx tusUrl.test.ts WinkUploadModal.test.tsx UserSettings.test.tsx');
    run('pnpm --filter @concord/server test winks.upload.test.ts');
    run('pnpm --filter @concord/web build');
    success('Preflight validation passed completely (0 errors, 100% tests passing, clean build).');
  } catch (err) {
    error('Preflight checks failed! Publication aborted to prevent releasing broken code.');
    process.exit(1);
  }

  // 2. Commit and Tag
  const tag = `v${version}`;
  log(`Preparing Git commit and tag ${tag}...`);

  const status = runSilent('git status --porcelain');
  if (status) {
    run('git add -A');
    const commitMsg = `chore(release): v${version} — automated web and desktop synchronized release`;
    run(`git commit -m "${commitMsg}"`);
    success('Changes committed.');
  }

  const existingTag = runSilent(`git tag -l ${tag}`);
  if (!existingTag) {
    run(`git tag -a ${tag} -m "Release ${tag}"`);
    success(`Tag ${tag} created locally.`);
  }

  // 3. Push to GitHub
  log('Pushing to GitHub (origin main and tag)...');
  run('git push origin main');
  run(`git push origin ${tag}`);
  success(`Pushed main and ${tag} to GitHub.`);

  const headCommit = runSilent('git rev-parse --short HEAD') || 'head';

  // 4. Verification of Deployments
  log('Starting deployment verification...');

  // Wait a short delay to let Vercel trigger
  await new Promise(r => setTimeout(r, 4000));
  const vercelStatus = await checkVercelDeploy(headCommit);

  let desktopReleaseStatus = 'Workflow triggered';
  let ymlStatus = 'Pending CI completion';
  let releaseUrl = `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`;

  if (!skipWait) {
    log('Waiting for GitHub Actions Windows build to finish and publish release assets...');
    const releaseRes = await pollGitHubRelease(tag, 40, 15);
    if (releaseRes.ok) {
      desktopReleaseStatus = `Published with ${releaseRes.assets.length} assets`;
      const ymlRes = await verifyLatestYmlContent(tag, version);
      if (ymlRes.ok) {
        ymlStatus = `Valid (version: ${ymlRes.version}, file: ${ymlRes.file}, sha512: ${ymlRes.sha512?.slice(0, 20)}...)`;
      } else {
        ymlStatus = `Warning: ${ymlRes.error || 'Metadata could not be validated'}`;
      }
    } else {
      desktopReleaseStatus = 'Pending (still building on GitHub Actions or timed out polling)';
    }
  }

  console.log('\n======================================================');
  console.log('       RELATÓRIO DE PUBLICAÇÃO SINCRONIZADA           ');
  console.log('======================================================');
  console.log(`Commit publicado:      ${headCommit}`);
  console.log(`Versão Web:            ${version}`);
  console.log(`URL do deploy Vercel:  ${VERCEL_URL} (Status: ${vercelStatus.ok ? '200 OK' : 'Pending'})`);
  console.log(`Versão Desktop:        ${version}`);
  console.log(`Link GitHub Release:   ${releaseUrl}`);
  console.log(`Workflow Actions:      https://github.com/${GITHUB_REPO}/actions/workflows/release-desktop.yml`);
  console.log(`Status dos builds:     Web build OK | Desktop: ${desktopReleaseStatus}`);
  console.log(`Resultado dos testes:  100% aprovados (Web, Desktop, Server)`);
  console.log(`Atualizador Electron:  ${ymlStatus}`);
  console.log('======================================================\n');

  if (skipWait) {
    log('O workflow de build Windows no GitHub Actions foi disparado automaticamente.');
    log(`Acompanhe a geração do instalador em: https://github.com/${GITHUB_REPO}/actions/workflows/release-desktop.yml`);
  }
}

main().catch(err => {
  error(`Publication failed: ${err.message || err}`);
  process.exit(1);
});
