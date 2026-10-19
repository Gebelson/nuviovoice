import { create } from 'zustand';
import { api } from '../api/client';
import type {
  Product,
  ProductCategory,
  Seller,
  ProductRevision,
  ProductReport,
} from '../types/store';

interface StoreState {
  categories: ProductCategory[];
  products: Product[];
  total: number;
  search: string;
  selectedCategory: string | null;
  selectedProductType: string | null;
  selectedSort: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
  favorites: Set<string>;
  favoriteProducts: Product[];
  mySeller: Seller | null;
  sellerProducts: Product[];
  adminQueue: { revisions: ProductRevision[]; reports: ProductReport[] } | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSearch: (search: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedProductType: (productType: string | null) => void;
  setSelectedSort: (sort: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'rating') => void;
  
  loadCategories: () => Promise<void>;
  loadProducts: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<boolean>;
  
  loadMySeller: () => Promise<Seller | null>;
  applySeller: (data: { storeName: string; slug?: string; bio?: string; contactEmail?: string }) => Promise<Seller>;
  updateSeller: (data: { storeName?: string; bio?: string; avatar?: string | null; banner?: string | null; contactEmail?: string | null }) => Promise<Seller>;
  
  loadSellerProducts: () => Promise<Product[]>;
  createProduct: (data: any) => Promise<Product>;
  
  loadAdminQueue: () => Promise<void>;
  reviewRevision: (id: string, action: 'approve' | 'reject' | 'changes_requested', notes?: string) => Promise<boolean>;
  setProductStatus: (id: string, status: 'published' | 'suspended' | 'archived') => Promise<boolean>;
  resolveReport: (id: string, action: 'dismiss' | 'suspend_product') => Promise<boolean>;
}

export const useStoreStore = create<StoreState>((set, get) => ({
  categories: [],
  products: [],
  total: 0,
  search: '',
  selectedCategory: null,
  selectedProductType: null,
  selectedSort: 'featured',
  favorites: new Set<string>(),
  favoriteProducts: [],
  mySeller: null,
  sellerProducts: [],
  adminQueue: null,
  isLoading: false,
  error: null,

  setSearch: (search) => {
    set({ search });
    void get().loadProducts();
  },

  setSelectedCategory: (selectedCategory) => {
    set({ selectedCategory });
    void get().loadProducts();
  },

  setSelectedProductType: (selectedProductType) => {
    set({ selectedProductType });
    void get().loadProducts();
  },

  setSelectedSort: (selectedSort) => {
    set({ selectedSort });
    void get().loadProducts();
  },

  loadCategories: async () => {
    try {
      const res = await api.store.getCategories();
      set({ categories: res.categories });
    } catch (err: any) {
      console.error('Failed to load store categories:', err);
    }
  },

  loadProducts: async () => {
    const { search, selectedCategory, selectedProductType, selectedSort } = get();
    set({ isLoading: true, error: null });
    try {
      const res = await api.store.getProducts({
        search: search.trim() || undefined,
        category: selectedCategory || undefined,
        productType: selectedProductType || undefined,
        sort: selectedSort,
        limit: 48,
      });
      set({ products: res.products, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load products', isLoading: false });
    }
  },

  loadFavorites: async () => {
    try {
      const res = await api.store.getFavorites();
      const favSet = new Set(res.products.map((p) => p.id));
      set({ favorites: favSet, favoriteProducts: res.products });
    } catch {
      // User might be unauthenticated or error
    }
  },

  toggleFavorite: async (productId: string) => {
    const { favorites, favoriteProducts, products } = get();
    const isFav = favorites.has(productId);
    const newFavorites = new Set(favorites);

    if (isFav) {
      newFavorites.delete(productId);
      set({
        favorites: newFavorites,
        favoriteProducts: favoriteProducts.filter((p) => p.id !== productId),
      });
      try {
        await api.store.removeFavorite(productId);
      } catch {
        // Rollback
        set({ favorites });
        return true;
      }
      return false;
    } else {
      newFavorites.add(productId);
      const product = products.find((p) => p.id === productId);
      set({
        favorites: newFavorites,
        favoriteProducts: product ? [...favoriteProducts, product] : favoriteProducts,
      });
      try {
        await api.store.addFavorite(productId);
      } catch {
        // Rollback
        set({ favorites });
        return false;
      }
      return true;
    }
  },

  loadMySeller: async () => {
    try {
      const res = await api.store.getMySeller();
      set({ mySeller: res.seller });
      return res.seller;
    } catch {
      return null;
    }
  },

  applySeller: async (data) => {
    const res = await api.store.applySeller(data);
    set({ mySeller: res.seller });
    return res.seller;
  },

  updateSeller: async (data) => {
    const res = await api.store.updateSeller(data);
    set({ mySeller: res.seller });
    return res.seller;
  },

  loadSellerProducts: async () => {
    try {
      const res = await api.store.getMyProducts();
      set({ sellerProducts: res.products });
      return res.products;
    } catch (err) {
      console.error('Failed to load seller products:', err);
      return [];
    }
  },

  createProduct: async (data) => {
    const res = await api.store.createProduct(data);
    const sellerProducts = get().sellerProducts;
    set({ sellerProducts: [res.product, ...sellerProducts] });
    return res.product;
  },

  loadAdminQueue: async () => {
    try {
      const res = await api.store.adminGetQueue();
      set({ adminQueue: res });
    } catch (err) {
      console.error('Failed to load admin queue:', err);
    }
  },

  reviewRevision: async (id, action, notes) => {
    try {
      await api.store.adminReviewRevision(id, { action, notes });
      await get().loadAdminQueue();
      await get().loadProducts();
      return true;
    } catch (err) {
      console.error('Failed to review revision:', err);
      return false;
    }
  },

  setProductStatus: async (id, status) => {
    try {
      await api.store.adminSetProductStatus(id, { status });
      await get().loadAdminQueue();
      await get().loadProducts();
      return true;
    } catch (err) {
      console.error('Failed to set product status:', err);
      return false;
    }
  },

  resolveReport: async (id, action) => {
    try {
      await api.store.adminResolveReport(id, { action });
      await get().loadAdminQueue();
      return true;
    } catch (err) {
      console.error('Failed to resolve report:', err);
      return false;
    }
  },
}));
