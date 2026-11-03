import React from 'react';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface MarketplaceCategorySelectorProps {
  categories: CategoryItem[];
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  allLabel?: string;
}

export function MarketplaceCategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
  allLabel = 'Todas as Categorias',
}: MarketplaceCategorySelectorProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
          selectedCategory === null
            ? 'bg-accent-primary text-white border-accent-primary shadow-md shadow-accent-primary/20'
            : 'bg-surface-panel/60 text-txt-secondary border-border-hard hover:bg-surface-panel hover:text-white'
        }`}
      >
        {allLabel}
      </button>
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.slug;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(isSelected ? null : cat.slug)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
              isSelected
                ? 'bg-accent-primary text-white border-accent-primary shadow-md shadow-accent-primary/20'
                : 'bg-surface-panel/60 text-txt-secondary border-border-hard hover:bg-surface-panel hover:text-white'
            }`}
          >
            {cat.icon && <span>{cat.icon}</span>}
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
