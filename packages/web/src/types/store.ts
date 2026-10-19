export type ProductType = 'digital' | 'physical' | 'service';

export type ProductStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'suspended'
  | 'archived';

export type RevisionStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected';

export type SellerStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  bio?: string;
  avatar?: string | null;
  banner?: string | null;
  status: SellerStatus;
  contactEmail?: string | null;
  reviewNotes?: string | null;
  createdAt: number;
}

export interface VisualBlock {
  id: string;
  type:
    | 'hero'
    | 'heading'
    | 'paragraph'
    | 'image'
    | 'gallery'
    | 'feature_grid'
    | 'faq'
    | 'testimonials'
    | 'video'
    | 'specs'
    | 'button_cta'
    | 'divider';
  props: Record<string, any>;
}

export interface Product {
  id: string;
  sellerId: string;
  categoryId?: string | null;
  title: string;
  slug: string;
  shortDescription: string;
  productType: ProductType;
  price: number;
  currency: string;
  thumbnail?: string | null;
  images: string[];
  status: ProductStatus;
  publishedRevisionId?: string | null;
  salesCount: number;
  rating: number;
  ratingCount: number;
  createdAt: number;
  updatedAt: number;
  seller?: {
    id: string;
    storeName: string;
    slug: string;
    avatar?: string | null;
    banner?: string | null;
    bio?: string;
    status: SellerStatus;
    contactEmail?: string | null;
  };
  category?: ProductCategory | null;
  layoutData?: VisualBlock[];
  customCss?: string;
}

export interface ProductRevision {
  id: string;
  productId: string;
  version: number;
  title: string;
  shortDescription?: string;
  price: number;
  currency: string;
  thumbnail?: string | null;
  images: string[];
  layoutData: VisualBlock[];
  customCss?: string;
  status: RevisionStatus;
  reviewNotes?: string | null;
  submittedAt?: number | null;
  reviewedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  product?: Product;
  seller?: Seller;
}

export interface ProductReport {
  id: string;
  productId: string;
  reporterId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  actionTaken?: string | null;
  createdAt: number;
  product?: Product;
  reporter?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
  };
}
