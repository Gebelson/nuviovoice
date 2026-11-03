import React from 'react';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface MarketplaceSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  className?: string;
}

export function MarketplaceSegmentedControl<T extends string = string>({
  options,
  selectedId,
  onSelect,
  className = '',
}: MarketplaceSegmentedControlProps<T>) {
  return (
    <div className={`inline-flex items-center gap-1 bg-surface-base/80 p-1 rounded-xl border border-border-hard ${className}`}>
      {options.map((opt) => {
        const isSelected = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isSelected
                ? 'bg-surface-panel text-white shadow-sm'
                : 'text-txt-tertiary hover:text-txt-secondary'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/10 text-white' : 'bg-surface-base text-txt-muted'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
