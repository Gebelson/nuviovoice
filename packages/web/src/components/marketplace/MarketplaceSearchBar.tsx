import React from 'react';

interface MarketplaceSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onClear?: () => void;
  className?: string;
}

export function MarketplaceSearchBar({
  value,
  onChange,
  placeholder,
  onClear,
  className = '',
}: MarketplaceSearchBarProps) {
  return (
    <div className={`relative w-full ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-surface-channel/90 border border-border-hard hover:border-border-soft text-white placeholder:text-txt-tertiary text-sm shadow-xl focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 backdrop-blur-xl transition-all"
      />
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-tertiary pointer-events-none"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-tertiary hover:text-white transition-colors text-xs font-bold"
          title="Limpar busca"
        >
          ✕
        </button>
      )}
    </div>
  );
}
