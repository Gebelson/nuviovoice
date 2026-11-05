import type { Activity } from '@concord/shared';
import { getPrimaryActivity } from '@concord/shared/src/activities.js';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { replaceEmojiShortcodes, useEmojiShortcodeNames } from '../../utils/emojiShortcodes';

export interface ActivityCardProps {
  activities: Activity[];
  fallbackCustomStatus?: string | null;
  variant?: 'compact' | 'full' | 'inline';
  showIcon?: boolean;
  className?: string;
}

export function formatElapsed(startMs: number, t: TFunction<'common'>): string {
  const elapsed = Date.now() - startMs;
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(minutes / 60);
  const duration = hours > 0
    ? t('time.hoursMinutesShort', { hours, minutes: minutes % 60 })
    : t('time.minutesShort', { minutes });
  return t('time.elapsed', { duration });
}

export function getActivityIcon(type: Activity['type']): string {
  switch (type) {
    case 'playing': return '🎮';
    case 'listening': return '🎧';
    case 'watching': return '📺';
    case 'streaming': return '🔴';
    default: return '';
  }
}

export function getActivityVerb(type: Activity['type'], name: string, t: TFunction<'common'>): string {
  switch (type) {
    case 'playing':
      return t('activity.playing', { name, defaultValue: `Jogando ${name}` });
    case 'listening':
      return t('activity.listening', { name, defaultValue: `Ouvindo ${name}` });
    case 'watching':
      return t('activity.watching', { name, defaultValue: `Assistindo ${name}` });
    case 'streaming':
      return t('activity.streaming', { name, defaultValue: `Transmitindo ${name}` });
    default:
      return name;
  }
}

/** Returns the accent border color class for an activity type */
export function getActivityAccentClass(type: Activity['type']): string {
  switch (type) {
    case 'playing': return 'border-l-accent-mint';
    case 'listening': return 'border-l-accent-sky';
    case 'watching': return 'border-l-accent-lavender';
    case 'streaming': return 'border-l-accent-rose';
    default: return '';
  }
}

/** Returns whether an activity should get the glass card row treatment */
export function hasRichActivity(activities: Activity[]): boolean {
  const primary = getPrimaryActivity(activities);
  return !!primary && primary.type !== 'custom';
}

/**
 * Renders activity details (app name + elapsed time).
 * Supports compact (default), inline (for list subtitles), and full (for profile popouts/modals).
 */
export function ActivityCard({
  activities,
  fallbackCustomStatus,
  variant = 'compact',
  showIcon = true,
  className = '',
}: ActivityCardProps) {
  useEmojiShortcodeNames();
  const { t } = useTranslation('common');
  const primary = getPrimaryActivity(activities);

  if (!primary) {
    if (fallbackCustomStatus) {
      return (
        <div className={`text-[11px] leading-[1.3] text-txt-tertiary truncate ${className}`}>
          {replaceEmojiShortcodes(fallbackCustomStatus)}
        </div>
      );
    }
    return null;
  }

  // Custom status — plain text, no card treatment
  if (primary.type === 'custom') {
    return (
      <div className={`text-[11px] leading-[1.3] text-txt-tertiary truncate ${className}`}>
        {replaceEmojiShortcodes(primary.name)}
      </div>
    );
  }

  const icon = showIcon ? getActivityIcon(primary.type) : '';
  const verbText = getActivityVerb(primary.type, primary.name, t);

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-1.5 text-[12px] leading-tight text-txt-secondary truncate ${className}`}>
        {icon && <span className="text-[13px] flex-shrink-0">{icon}</span>}
        <span className="font-medium text-txt-primary truncate">{verbText}</span>
        {primary.timestamps?.start && (
          <span className="text-[11px] text-txt-tertiary flex-shrink-0 opacity-80">
            · {formatElapsed(primary.timestamps.start, t)}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`rounded-xl p-3 border border-white/[0.08] bg-surface-elevated/40 space-y-2 ${className}`}>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide font-semibold text-txt-tertiary">
          <span className="flex items-center gap-1.5">
            {icon && <span>{icon}</span>}
            <span>{t('activity.title', { defaultValue: 'Atividade' })}</span>
          </span>
          {primary.timestamps?.start && (
            <span className="text-[10px] lowercase font-normal text-txt-tertiary">
              {formatElapsed(primary.timestamps.start, t)}
            </span>
          )}
        </div>
        <div>
          <div className="text-[12px] font-medium text-txt-secondary">
            {verbText}
          </div>
          <div className="font-semibold text-[14px] text-txt-primary truncate mt-0.5">
            {primary.name}
          </div>
          {primary.details && (
            <div className="text-[12px] text-txt-secondary truncate mt-0.5">
              {primary.details}
            </div>
          )}
          {primary.state && (
            <div className="text-[11px] text-txt-tertiary truncate mt-0.5">
              {primary.state}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default 'compact'
  return (
    <div className={className}>
      <div className="text-[11px] leading-[1.3] text-txt-secondary truncate flex items-center gap-1">
        {icon && <span className="text-[11px] flex-shrink-0">{icon}</span>}
        <span>{primary.name}</span>
      </div>
      {primary.timestamps?.start && (
        <div className="text-[10px] leading-[1.3] text-txt-tertiary">
          {formatElapsed(primary.timestamps.start, t)}
        </div>
      )}
    </div>
  );
}
