import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StoreContainer } from './StoreContainer';
import { useStoreStore } from '../../stores/storeStore';
import { useBotStore } from '../../stores/botStore';
import { useAuthStore } from '../../stores/authStore';

describe('Store Navigation and Section Separation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Setup dummy auth
    useAuthStore.setState({
      user: {
        id: 'user-admin',
        username: 'admin_nuvio',
        email: 'admin@nuvio.app',
        isAdmin: true,
        displayName: 'Admin Nuvio',
        createdAt: new Date().toISOString(),
      } as any,
      token: 'mock-token',
    });

    // Reset store store
    useStoreStore.setState({
      products: [],
      categories: [],
      featuredProducts: [],
      favorites: [],
      isLoading: false,
      error: null,
      loadProducts: vi.fn(),
      loadCategories: vi.fn(),
      loadFavorites: vi.fn(),
    } as any);

    // Reset bot store
    useBotStore.setState({
      bots: [],
      categories: [],
      total: 0,
      search: '',
      selectedCategory: null,
      selectedSort: 'trending',
      isLoading: false,
      error: null,
      loadCategories: vi.fn(),
      loadBots: vi.fn(),
    } as any);
  });

  it('renders StoreFrontPage by default on /store with Produtos tab active and empty state message', () => {
    render(
      <MemoryRouter initialEntries={['/store']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>,
    );

    // Header title for products
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Loja de Produtos/i);

    // Check tablist and active state
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0]).toHaveTextContent(/Produtos/i);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveTextContent(/Bots/i);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

    // Section 11 empty state requirement
    expect(screen.getByText('Nenhum produto disponível no momento.')).toBeInTheDocument();
  });

  it('renders BotCatalogPage on /store/bots with Bots tab active and empty state message', () => {
    render(
      <MemoryRouter initialEntries={['/store/bots']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>,
    );

    // Heading for bots library
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Biblioteca de Bots/i);

    // Check tablist and active state
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0]).toHaveTextContent(/Produtos/i);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[1]).toHaveTextContent(/Bots/i);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

    // Section 11 empty state requirement
    expect(screen.getByText('Nenhum bot disponível no momento.')).toBeInTheDocument();
  });

  it('renders StoreAdminQueue on /store/admin with both Produtos and Bots queues', async () => {
    const { api } = await import('../../api/client');
    vi.spyOn(api.store, 'adminGetQueue').mockResolvedValue({
      pendingProducts: [],
      reports: [],
    } as any);
    vi.spyOn(api.bots, 'adminGetQueue').mockResolvedValue({
      bots: [],
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/admin']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>,
    );

    // Admin queue title
    expect(await screen.findByText(/Administração & Moderação/i)).toBeInTheDocument();

    // Both queue tabs present
    expect(screen.getByRole('button', { name: /Produtos Pendentes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bots Pendentes/i })).toBeInTheDocument();
  });

  it('renders StoreFrontPage on /store/products with Produtos tab active', () => {
    render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Loja de Produtos/i);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('renders error state and retry button on StoreFrontPage when product loading fails', () => {
    const loadProductsMock = vi.fn();
    useStoreStore.setState({
      products: [],
      categories: [],
      featuredProducts: [],
      favorites: [],
      isLoading: false,
      error: 'Servidor indisponível',
      loadProducts: loadProductsMock,
      loadCategories: vi.fn(),
      loadFavorites: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/store']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Falha ao carregar produtos')).toBeInTheDocument();
    expect(screen.getByText('Servidor indisponível')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(loadProductsMock).toHaveBeenCalled();
  });

  it('renders error state and retry button on BotCatalogPage when bot loading fails', () => {
    const loadBotsMock = vi.fn();
    useBotStore.setState({
      bots: [],
      categories: [],
      total: 0,
      search: '',
      selectedCategory: null,
      selectedSort: 'trending',
      isLoading: false,
      error: 'Falha de conexão com a API de bots',
      loadCategories: vi.fn(),
      loadBots: loadBotsMock,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/bots']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Falha ao carregar bots')).toBeInTheDocument();
    expect(screen.getByText('Falha de conexão com a API de bots')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(loadBotsMock).toHaveBeenCalled();
  });
});
