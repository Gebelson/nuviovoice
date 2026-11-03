import React from 'react';
import { Toggle } from '../../../ui/Toggle';

export interface SubsectionTabItem {
  id: string;
  title: string;
  badge?: string;
}

interface SettingsHubHeaderProps {
  categoryLabel: string;
  title: string;
  subtitle: string;
  subsections?: SubsectionTabItem[];
  activeSubsection?: string;
  onSelectSubsection?: (id: string) => void;
}

export function SettingsHubHeader({
  categoryLabel,
  title,
  subtitle,
  subsections,
  activeSubsection,
  onSelectSubsection,
}: SettingsHubHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-accent-primary/15 text-accent-primary border border-accent-primary/20">
          {categoryLabel}
        </span>
      </div>
      <h2 className="text-xl font-semibold text-txt-primary tracking-tight">{title}</h2>
      <p className="text-xs text-txt-secondary mt-1 leading-relaxed max-w-xl">{subtitle}</p>

      {subsections && subsections.length > 1 && onSelectSubsection && (
        <div
          role="tablist"
          className="flex flex-wrap gap-1.5 mt-4 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05]"
        >
          {subsections.map((item) => {
            const active = item.id === activeSubsection;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectSubsection(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-accent-primary/20 text-txt-primary border border-accent-primary/30 shadow-sm'
                    : 'text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span>{item.title}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/[0.08] text-txt-secondary">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SettingsCardSectionProps {
  heading: string;
  description?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsCardSection({
  heading,
  description,
  rightSlot,
  children,
}: SettingsCardSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3 px-0.5">
        <div>
          <h3 className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider">
            {heading}
          </h3>
          {description && (
            <p className="text-xs text-txt-secondary mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
        {children}
      </div>
    </section>
  );
}

interface SettingsToggleItemProps {
  heading: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  badgeText?: string;
}

export function SettingsToggleItem({
  heading,
  description,
  checked,
  onChange,
  disabled,
  badgeText,
}: SettingsToggleItemProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-txt-primary">{heading}</span>
          {badgeText && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-primary/15 text-accent-primary border border-accent-primary/25">
              {badgeText}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-txt-tertiary mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <Toggle
        enabled={checked}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={heading}
      />
    </div>
  );
}

interface SettingsRadioOptionProps {
  selected: boolean;
  onSelect: () => void;
  heading: string;
  description: string;
  badgeText?: string;
  disabled?: boolean;
}

export function SettingsRadioOption({
  selected,
  onSelect,
  heading,
  description,
  badgeText,
  disabled,
}: SettingsRadioOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`w-full text-left flex items-start gap-3.5 p-4 transition-colors ${
        selected
          ? 'bg-accent-primary/[0.09]'
          : 'hover:bg-white/[0.03]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
          selected
            ? 'border-accent-primary bg-accent-primary/20'
            : 'border-white/25 bg-transparent'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-accent-primary" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-txt-primary">{heading}</span>
          {badgeText && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-mint/15 text-accent-mint">
              {badgeText}
            </span>
          )}
        </div>
        <p className="text-xs text-txt-tertiary mt-0.5 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

interface SettingsRelatedShortcutProps {
  heading: string;
  description: string;
  actionText: string;
  onClick: () => void;
}

export function SettingsRelatedShortcut({
  heading,
  description,
  actionText,
  onClick,
}: SettingsRelatedShortcutProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-accent-primary/[0.08] via-white/[0.02] to-transparent border border-accent-primary/20 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-txt-primary">{heading}</div>
        <p className="text-xs text-txt-secondary mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-txt-primary border border-white/[0.08] transition-colors"
      >
        <span>{actionText}</span>
        <svg className="w-3.5 h-3.5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}

interface SettingsInfoCalloutProps {
  heading: string;
  body: string;
  tone?: 'info' | 'mint' | 'amber';
}

export function SettingsInfoCallout({
  heading,
  body,
  tone = 'info',
}: SettingsInfoCalloutProps) {
  const toneStyles =
    tone === 'mint'
      ? 'bg-accent-mint/[0.07] border-accent-mint/20 text-accent-mint'
      : tone === 'amber'
        ? 'bg-amber-500/[0.08] border-amber-500/20 text-amber-300'
        : 'bg-accent-primary/[0.07] border-accent-primary/20 text-accent-lavender';

  return (
    <div className={`rounded-xl border p-4 ${toneStyles}`}>
      <div className="flex items-start gap-3">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-txt-primary">{heading}</div>
          <p className="text-xs text-txt-secondary mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
