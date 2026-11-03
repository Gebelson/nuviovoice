import { describe, it, expect } from 'vitest';
import { activeHomeNavItem, isDirectMessagesRailActive, normalizePathname } from './homeNav';

describe('normalizePathname', () => {
  it('strips query strings and hash fragments', () => {
    expect(normalizePathname('/download?ref=sidebar#top')).toBe('/download');
  });

  it('strips trailing slashes from paths', () => {
    expect(normalizePathname('/download/')).toBe('/download');
    expect(normalizePathname('/opportunities/')).toBe('/opportunities');
    expect(normalizePathname('/')).toBe('/');
  });
});

describe('activeHomeNavItem', () => {
  it('selects Explore on /explore', () => {
    expect(activeHomeNavItem('/explore', null)).toBe('explore');
  });

  it('selects Backspace on /backspace', () => {
    expect(activeHomeNavItem('/backspace', null)).toBe('backspace');
  });

  it('selects Download on /download', () => {
    expect(activeHomeNavItem('/download', null)).toBe('download');
    expect(activeHomeNavItem('/download/', null)).toBe('download');
  });

  it('selects Store on /store and /developers', () => {
    expect(activeHomeNavItem('/store', null)).toBe('store');
    expect(activeHomeNavItem('/store/bots', null)).toBe('store');
    expect(activeHomeNavItem('/developers', null)).toBe('store');
    expect(activeHomeNavItem('/developers/bots', null)).toBe('store');
  });

  it('selects Opportunities on /opportunities', () => {
    expect(activeHomeNavItem('/opportunities', null)).toBe('opportunities');
    expect(activeHomeNavItem('/opportunities/jobs', null)).toBe('opportunities');
  });

  it('selects Friends on the DM home with no channel open', () => {
    expect(activeHomeNavItem('/channels/@me', null)).toBe('friends');
    expect(activeHomeNavItem('/', null)).toBe('friends');
  });

  it('selects nothing while a DM conversation is open', () => {
    expect(activeHomeNavItem('/channels/@me/dm-1', 'dm-1')).toBeNull();
    expect(activeHomeNavItem('/channels/@me/dm-1', null)).toBeNull();
  });

  it('selects nothing in a space channel or space root', () => {
    expect(activeHomeNavItem('/channels/space-1/channel-1', 'channel-1')).toBeNull();
    expect(activeHomeNavItem('/channels/space-1', null)).toBeNull();
  });

  it('selects nothing on livestreams or unknown routes', () => {
    expect(activeHomeNavItem('/live/stream-1', null)).toBeNull();
    expect(activeHomeNavItem('/settings', null)).toBeNull();
    expect(activeHomeNavItem('/random-page', null)).toBeNull();
  });

  it('does not treat a path that only starts with a page name as that page', () => {
    expect(activeHomeNavItem('/backspace-old', null)).toBeNull();
    expect(activeHomeNavItem('/explorer', null)).toBeNull();
    expect(activeHomeNavItem('/download-something', null)).toBeNull();
  });
});

describe('isDirectMessagesRailActive', () => {
  it('is active on Friends home (/channels/@me or /)', () => {
    expect(isDirectMessagesRailActive('/channels/@me')).toBe(true);
    expect(isDirectMessagesRailActive('/')).toBe(true);
  });

  it('is active when chatting in a direct message (/channels/@me/:channelId)', () => {
    expect(isDirectMessagesRailActive('/channels/@me/dm-123')).toBe(true);
  });

  it('is active on /backspace', () => {
    expect(isDirectMessagesRailActive('/backspace')).toBe(true);
  });

  it('is NOT active on /download (Baixar Nuvio)', () => {
    expect(isDirectMessagesRailActive('/download')).toBe(false);
    expect(isDirectMessagesRailActive('/download/')).toBe(false);
  });

  it('is NOT active on /opportunities or /opportunities/*', () => {
    expect(isDirectMessagesRailActive('/opportunities')).toBe(false);
    expect(isDirectMessagesRailActive('/opportunities/jobs')).toBe(false);
  });

  it('is NOT active on /store or /developers', () => {
    expect(isDirectMessagesRailActive('/store')).toBe(false);
    expect(isDirectMessagesRailActive('/store/bots')).toBe(false);
    expect(isDirectMessagesRailActive('/developers')).toBe(false);
  });

  it('is NOT active on /explore', () => {
    expect(isDirectMessagesRailActive('/explore')).toBe(false);
  });

  it('is NOT active on space channels or space pages', () => {
    expect(isDirectMessagesRailActive('/channels/space-123')).toBe(false);
    expect(isDirectMessagesRailActive('/channels/space-123/channel-456')).toBe(false);
  });

  it('is NOT active on livestreams', () => {
    expect(isDirectMessagesRailActive('/live/stream-123')).toBe(false);
  });
});
