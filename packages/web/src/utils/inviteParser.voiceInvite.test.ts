import { describe, it, expect } from 'vitest';
import { voiceInviteUrl, parseVoiceInviteToken } from './inviteParser';

describe('voiceInviteUrl', () => {
  it('constructs universal https URL for voice invites', () => {
    const url = voiceInviteUrl('token123_abc');
    expect(url).toBe('https://nuviovoice.vercel.app/voice/invite/token123_abc');
  });
});

describe('parseVoiceInviteToken', () => {
  it('extracts token from full https URL', () => {
    expect(parseVoiceInviteToken('https://nuviovoice.vercel.app/voice/invite/AbCd1234_xyz')).toBe('AbCd1234_xyz');
  });

  it('extracts raw token directly', () => {
    expect(parseVoiceInviteToken('AbCd1234_xyz')).toBe('AbCd1234_xyz');
  });

  it('returns null for empty or invalid inputs', () => {
    expect(parseVoiceInviteToken('')).toBeNull();
    expect(parseVoiceInviteToken('   ')).toBeNull();
  });
});
