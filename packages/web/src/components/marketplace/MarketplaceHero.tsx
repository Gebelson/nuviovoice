import React from 'react';

interface MarketplaceHeroProps {
  badgeIcon?: React.ReactNode;
  badgeText: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  navTabs?: React.ReactNode;
  searchBar?: React.ReactNode;
}

export function MarketplaceHero({
  badgeIcon,
  badgeText,
  title,
  description,
  actions,
  navTabs,
  searchBar,
}: MarketplaceHeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-accent-primary/15 via-surface-panel to-surface-chat border-b border-border-hard px-6 py-10 md:py-12">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/15 text-accent-primary border border-accent-primary/25 text-xs font-bold uppercase tracking-wider mb-3">
              {badgeIcon}
              <span>{badgeText}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-sm md:text-base text-txt-secondary mt-1.5 max-w-xl leading-relaxed">
              {description}
            </p>
          </div>

          {actions && (
            <div className="flex items-center gap-3 flex-wrap">
              {actions}
            </div>
          )}
        </div>

        {navTabs && <div>{navTabs}</div>}

        {searchBar && <div className="max-w-2xl">{searchBar}</div>}
      </div>
    </div>
  );
}
