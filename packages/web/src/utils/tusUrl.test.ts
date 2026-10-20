import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveTusUrl, tusEndpoint, getHomeOrigin } from './tusUrl';

describe('resolveTusUrl', () => {
  it('resolves a relative Location against the home origin when no origin is given', () => {
    // jsdom serves the test page from http://localhost:3000
    expect(resolveTusUrl('/api/files/abc', undefined)).toBe('http://localhost:3000/api/files/abc');
    expect(resolveTusUrl('/api/files/abc', '')).toBe('http://localhost:3000/api/files/abc');
  });

  it('resolves a relative Location against a remote origin', () => {
    expect(resolveTusUrl('/api/files/abc', 'https://orbit.example')).toBe('https://orbit.example/api/files/abc');
    expect(resolveTusUrl('/api/files/abc', 'https://orbit.example/')).toBe('https://orbit.example/api/files/abc');
  });

  it('keeps the port the client actually used', () => {
    expect(resolveTusUrl('/api/files/abc', 'https://chat.example.com:1443')).toBe('https://chat.example.com:1443/api/files/abc');
  });

  it('leaves an absolute Location untouched', () => {
    expect(resolveTusUrl('https://chat.example.com:1443/api/files/abc', undefined)).toBe('https://chat.example.com:1443/api/files/abc');
    expect(resolveTusUrl('https://orbit.example/api/files/abc', 'https://nova.example')).toBe('https://orbit.example/api/files/abc');
  });
});

describe('tusEndpoint', () => {
  it('is absolute for the home instance', () => {
    expect(tusEndpoint(undefined)).toBe('http://localhost:3000/api/files/');
    expect(tusEndpoint('')).toBe('http://localhost:3000/api/files/');
  });

  it('targets the remote origin, with or without a trailing slash', () => {
    expect(tusEndpoint('https://orbit.example')).toBe('https://orbit.example/api/files/');
    expect(tusEndpoint('https://orbit.example/')).toBe('https://orbit.example/api/files/');
    expect(tusEndpoint('https://chat.example.com:1443')).toBe('https://chat.example.com:1443/api/files/');
  });

  it('honours desktop nuvioConfig backendUrl when set', () => {
    const originalNuvioConfig = (window as any).nuvioConfig;
    try {
      (window as any).nuvioConfig = { backendUrl: 'https://backend.nuvio.app' };
      expect(getHomeOrigin()).toBe('https://backend.nuvio.app');
      expect(tusEndpoint(undefined)).toBe('https://backend.nuvio.app/api/files/');
      expect(resolveTusUrl('/api/files/test123', undefined)).toBe('https://backend.nuvio.app/api/files/test123');
    } finally {
      (window as any).nuvioConfig = originalNuvioConfig;
    }
  });
});
