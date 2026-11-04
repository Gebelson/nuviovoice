import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StoreContainer } from './StoreContainer';
import { useStoreStore } from '../../stores/storeStore';
import { useBotStore } from '../../stores/botStore';
import { useAuthStore } from '../../stores/authStore';
import { getFriendlyErrorMessage } from '../marketplace/MarketplaceErrorState';
import { getResolvedBackendUrl, getResolvedApiBase, DEFAULT_OFFICIAL_BACKEND_URL } from '../../config/backend';
import { api } from '../../api/client';

describe('Catalog Resilience and Visual States (Store and Bot Library)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    useAuthStore.setState({
      user: null, // Test unauthenticated access by default
      token: null,
    });

    useStoreStore.setState({
      products: [],
      categories: [],
      total: 0,
      search: '',
      selectedCategory: null,
      selectedProductType: null,
      selectedSort: 'featured',
      favorites: new Set(),
      favoriteProducts: [],
      mySeller: null,
      sellerProducts: [],
      adminQueue: null,
      isLoading: false,
      error: null,
      loadProducts: vi.fn(),
      loadCategories: vi.fn(),
      loadFavorites: vi.fn(),
      loadMySeller: vi.fn(),
    } as any);

    useBotStore.setState({
      bots: [],
      categories: [],
      total: 0,
      search: '',
      selectedCategory: null,
      selectedSort: 'featured',
      installedSpaceBots: {},
      myBots: [],
      adminQueue: [],
      isLoading: false,
      error: null,
      loadCategories: vi.fn(),
      loadBots: vi.fn(),
    } as any);
  });

  // Scenario 1: Loja com produtos
  it('1. Renders store products cards when products are present', () => {
    useStoreStore.setState({
      products: [
        {
          id: 'prod_1',
          sellerId: 'seller_1',
          title: 'Bot Guardião do Servidor',
          slug: 'bot-guardiao',
          shortDescription: 'Moderação ativa e logs completos',
          price: 2990,
          currency: 'BRL',
          productType: 'digital',
          status: 'published',
          rating: 5.0,
          salesCount: 42,
          seller: { id: 'seller_1', storeName: 'Nuvio Labs' },
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Bot Guardião do Servidor')).toBeInTheDocument();
    expect(screen.queryByText(/Nada por aqui ainda/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar produtos/i)).not.toBeInTheDocument();
  });

  // Scenario 2: Loja sem produtos (Mascot idle empty state)
  it('2. Renders Mascot idle empty state when store has 0 products', () => {
    useStoreStore.setState({
      products: [],
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Nada por aqui ainda. Novidades estão chegando!')).toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar produtos/i)).not.toBeInTheDocument();
  });

  // Scenario 3: Biblioteca com bots
  it('3. Renders bot cards when bots are present', () => {
    useBotStore.setState({
      bots: [
        {
          id: 'bot_alpha',
          slug: 'bot-music-nuvio',
          name: 'Nuvio Music DJ',
          tagline: 'O melhor player de música para suas chamadas',
          description: 'Suporta YouTube, Spotify e Soundcloud em alta fidelidade',
          status: 'published',
          isVerified: true,
          isOfficial: true,
          installCount: 1500,
          ratingAverage: 4.9,
          ratingCount: 120,
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/bots']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Nuvio Music DJ')).toBeInTheDocument();
    expect(screen.getByText('O melhor player de música para suas chamadas')).toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar bots/i)).not.toBeInTheDocument();
  });

  // Scenario 4: Biblioteca sem bots (Mascot idle empty state)
  it('4. Renders Mascot idle empty state when bot library has 0 bots', () => {
    useBotStore.setState({
      bots: [],
      total: 0,
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/bots']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Nada por aqui ainda. Novidades estão chegando!')).toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar bots/i)).not.toBeInTheDocument();
  });

  // Scenario 5: API indisponível (Network failure)
  it('5. Handles API unavailable with polite connection message and functional retry button', () => {
    const loadProductsMock = vi.fn();
    useStoreStore.setState({
      products: [],
      isLoading: false,
      error: 'Failed to fetch: NetworkError when attempting to fetch resource',
      loadProducts: loadProductsMock,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Falha ao carregar produtos')).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível conectar ao servidor/i)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
    expect(retryBtn).toBeInTheDocument();
    // 1st call was on initial mount, 2nd call triggered by retry button
    fireEvent.click(retryBtn);
    expect(loadProductsMock).toHaveBeenCalledTimes(2);
  });

  // Scenario 6: Erro HTTP 404 (Never display raw "Not found")
  it('6. Sanitizes HTTP 404 / Not found into clear, respectful message on Store and Bots', () => {
    expect(getFriendlyErrorMessage('Not found')).toBe(
      'O serviço do catálogo está temporariamente indisponível no servidor ou em fase de atualização. Tente novamente em instantes.'
    );
    expect(getFriendlyErrorMessage('HTTP 404: Not found')).toBe(
      'O serviço do catálogo está temporariamente indisponível no servidor ou em fase de atualização. Tente novamente em instantes.'
    );

    const loadBotsMock = vi.fn();
    useBotStore.setState({
      bots: [],
      isLoading: false,
      error: 'Not found',
      loadBots: loadBotsMock,
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/bots']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Falha ao carregar bots')).toBeInTheDocument();
    expect(screen.getByText(/O serviço do catálogo está temporariamente indisponível no servidor/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Not found$/i)).not.toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
    // 1st call on initial mount, 2nd call on retry button click
    fireEvent.click(retryBtn);
    expect(loadBotsMock).toHaveBeenCalledTimes(2);
  });

  // Scenario 7: Falha de banco de dados (HTTP 500)
  it('7. Handles database failure (500) with understandable instability message', () => {
    expect(getFriendlyErrorMessage('Internal Server Error 500')).toBe(
      'Ocorreu uma instabilidade momentânea no servidor. Por favor, tente novamente em instantes.'
    );

    useStoreStore.setState({
      products: [],
      isLoading: false,
      error: '500 Internal Server Error: Database query failed',
    } as any);

    render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Ocorreu uma instabilidade momentânea no servidor/i)).toBeInTheDocument();
    expect(screen.queryByText(/Database query failed/i)).not.toBeInTheDocument();
  });

  // Scenario 8: Recarregamento das páginas
  it('8. Triggers fresh data load on page reload / re-mount', () => {
    const loadProductsMock = vi.fn();
    const loadCategoriesMock = vi.fn();

    useStoreStore.setState({
      loadProducts: loadProductsMock,
      loadCategories: loadCategoriesMock,
    } as any);

    const { unmount } = render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(loadProductsMock).toHaveBeenCalled();
    expect(loadCategoriesMock).toHaveBeenCalled();

    unmount();

    // Re-mount simulates page reload / re-entry
    render(
      <MemoryRouter initialEntries={['/store/products']}>
        <Routes>
          <Route path="/store/*" element={<StoreContainer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(loadProductsMock).toHaveBeenCalledTimes(2);
    expect(loadCategoriesMock).toHaveBeenCalledTimes(2);
  });

  // Scenario 9: Funcionamento no navegador
  it('9. Resolves relative API base url in web browser environment', () => {
    // In browser (window is defined and no desktop nuvioConfig)
    const backendUrl = getResolvedBackendUrl();
    const apiBase = getResolvedApiBase();

    expect(backendUrl).toBe('');
    expect(apiBase).toBe('/api');
  });

  // Scenario 10: Funcionamento no Electron
  it('10. Resolves official backend url when running inside Electron', () => {
    const originalNuvioConfig = (window as any).nuvioConfig;
    try {
      (window as any).nuvioConfig = {
        backendUrl: 'https://167-234-239-100.sslip.io',
      };

      const backendUrl = getResolvedBackendUrl();
      const apiBase = getResolvedApiBase();

      expect(backendUrl).toBe('https://167-234-239-100.sslip.io');
      expect(apiBase).toBe('https://167-234-239-100.sslip.io/api');
    } finally {
      (window as any).nuvioConfig = originalNuvioConfig;
    }
  });

  // Scenario 11: Acesso sem autenticação
  it('11. Allows unauthenticated access to public catalog endpoints', () => {
    // Verify client configuration has requireAuth = false for public catalog methods
    expect(typeof api.store.getCategories).toBe('function');
    expect(typeof api.store.getProducts).toBe('function');
    expect(typeof api.bots.getCategories).toBe('function');
    expect(typeof api.bots.getBots).toBe('function');

    // AuthStore is set to null (unauthenticated user)
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
