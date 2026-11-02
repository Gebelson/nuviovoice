import React, { useState, useRef, useEffect } from 'react';
import {
  type VerificationCategory,
  type VerificationStatus,
  getVerificationExplanation,
} from '@concord/shared';

export interface VerificationBadgeProps {
  category?: VerificationCategory | null;
  status?: VerificationStatus | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function BadgeCheckIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity="0.18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity="0.22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function VerificationBadge({
  category,
  status = 'verified',
  size = 'sm',
  showTooltip = true,
  className = '',
}: VerificationBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close tooltip on outside click or escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [open]);

  if (!category || status !== 'verified') {
    return null;
  }

  const explanation = getVerificationExplanation(category);

  const sizePx = size === 'xs' ? 13 : size === 'sm' ? 15 : size === 'md' ? 18 : 22;

  const colorClass =
    explanation.badgeColor === 'green'
      ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.35)]'
      : explanation.badgeColor === 'purple'
      ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(192,132,252,0.4)]'
      : 'text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.35)]';

  const badgeIcon =
    explanation.iconType === 'shield' ? (
      <ShieldCheckIcon size={sizePx} className="shrink-0 transition-transform hover:scale-110" />
    ) : (
      <BadgeCheckIcon size={sizePx} className="shrink-0 transition-transform hover:scale-110" />
    );

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center justify-center align-middle select-none shrink-0 ${colorClass} ${className}`}
      onMouseEnter={() => showTooltip && setOpen(true)}
      onMouseLeave={() => showTooltip && setOpen(false)}
      tabIndex={showTooltip ? 0 : -1}
      onFocus={() => showTooltip && setOpen(true)}
      onBlur={() => showTooltip && setOpen(false)}
      role="button"
      aria-label={explanation.title}
      data-testid={`verification-badge-${category}`}
    >
      {badgeIcon}
      <span className="sr-only">{explanation.title}</span>

      {/* Floating Explanatory Popover / Tooltip */}
      {showTooltip && open && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[99999] pointer-events-none w-64 p-3 rounded-xl bg-[#14161f] text-white border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.6)] text-left animate-in fade-in zoom-in-95 duration-150"
          style={{ textShadow: 'none' }}
        >
          <span className="flex items-center gap-1.5 font-semibold text-xs text-white mb-1">
            <span className={colorClass}>
              {explanation.iconType === 'shield' ? (
                <ShieldCheckIcon size={14} />
              ) : (
                <BadgeCheckIcon size={14} />
              )}
            </span>
            <span>{explanation.title}</span>
          </span>
          <span className="block text-[11px] leading-relaxed text-txt-secondary mb-2 font-normal">
            {explanation.description}
          </span>
          <span className="block text-[10px] leading-tight text-txt-tertiary/80 border-t border-white/5 pt-1.5 font-normal">
            {explanation.disclaimer}
          </span>
        </span>
      )}
    </span>
  );
}
