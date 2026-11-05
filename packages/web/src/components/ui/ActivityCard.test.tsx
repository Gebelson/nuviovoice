import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@concord/shared';
import { setLanguage } from '../../i18n';
import { ActivityCard, getActivityIcon, getActivityVerb } from './ActivityCard';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
});

afterEach(async () => {
  await setLanguage('en');
  vi.useRealTimers();
});

describe('ActivityCard', () => {
  it('localizes the elapsed activity time', async () => {
    await setLanguage('ru');
    const activity: Activity = {
      type: 'playing',
      name: 'Escape from Tarkov',
      timestamps: { start: Date.now() - 32 * 60 * 1000 },
    };

    render(<ActivityCard activities={[activity]} />);

    expect(screen.getByText('Escape from Tarkov')).toBeInTheDocument();
    expect(screen.getByText('Прошло 32 мин.')).toBeInTheDocument();
  });

  it('renders emoji shortcodes in a custom status (issue #252)', () => {
    render(<ActivityCard activities={[{ type: 'custom', name: 'on call :pager:' }]} />);
    expect(screen.getByText('on call 📟')).toBeInTheDocument();
  });

  it('renders emoji shortcodes in the fallback custom status', () => {
    render(<ActivityCard activities={[]} fallbackCustomStatus="on call :pager:" />);
    expect(screen.getByText('on call 📟')).toBeInTheDocument();
  });

  it('renders inline variant with controller icon and localized verb', async () => {
    await setLanguage('pt');
    const activity: Activity = {
      type: 'playing',
      name: 'Genshin Impact',
      timestamps: { start: Date.now() - 15 * 60 * 1000 },
    };

    render(<ActivityCard activities={[activity]} variant="inline" />);

    expect(screen.getByText('🎮')).toBeInTheDocument();
    expect(screen.getByText('Jogando Genshin Impact')).toBeInTheDocument();
    expect(screen.getByText(/15 min decorridos/)).toBeInTheDocument();
  });

  it('renders full variant for profile cards', async () => {
    await setLanguage('pt');
    const activity: Activity = {
      type: 'playing',
      name: 'League of Legends',
      details: 'Summoner\'s Rift (Ranked)',
      timestamps: { start: Date.now() - 45 * 60 * 1000 },
    };

    render(<ActivityCard activities={[activity]} variant="full" />);

    expect(screen.getByText('Atividade')).toBeInTheDocument();
    expect(screen.getByText('League of Legends')).toBeInTheDocument();
    expect(screen.getByText('Summoner\'s Rift (Ranked)')).toBeInTheDocument();
    expect(screen.getByText('45 min decorridos')).toBeInTheDocument();
  });

  it('returns appropriate icon for each activity type', () => {
    expect(getActivityIcon('playing')).toBe('🎮');
    expect(getActivityIcon('listening')).toBe('🎧');
    expect(getActivityIcon('watching')).toBe('📺');
    expect(getActivityIcon('streaming')).toBe('🔴');
  });
});
