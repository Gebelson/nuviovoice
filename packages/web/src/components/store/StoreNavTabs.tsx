import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function StoreNavTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isBots = path === '/store/bots' || path.startsWith('/store/bots/');
  const isProducts = !isBots;

  return (
    <div
      role="tablist"
      aria-label="Seções da Loja"
      className="inline-flex p-1 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md shadow-lg"
    >
      <button
        type="button"
        role="tab"
        aria-selected={isProducts}
        onClick={() => navigate('/store/products')}
        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
          isProducts
            ? 'bg-accent-primary text-white shadow-md'
            : 'text-txt-secondary hover:text-white hover:bg-white/5'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        Produtos
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isBots}
        onClick={() => navigate('/store/bots')}
        className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
          isBots
            ? 'bg-accent-primary text-white shadow-md'
            : 'text-txt-secondary hover:text-white hover:bg-white/5'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18M3 9h18" />
        </svg>
        Bots
      </button>
    </div>
  );
}
