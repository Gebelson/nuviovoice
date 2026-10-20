import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { StoreFrontPage } from './StoreFrontPage';
import { ProductDetailPage } from './ProductDetailPage';
import { SellerDashboard } from './SellerDashboard';
import { SellerProfilePage } from './SellerProfilePage';
import { ProductEditorPage } from './ProductEditorPage';
import { StoreAdminQueue } from './StoreAdminQueue';
import { SellerApplyModal } from '../modals/SellerApplyModal';
import { ReportProductModal } from '../modals/ReportProductModal';
import { BotCatalogPage } from '../bots/BotCatalogPage';
import { BotDetailPage } from '../bots/BotDetailPage';
import { DeveloperPortal } from '../bots/DeveloperPortal';
import { BotEditorPage } from '../bots/BotEditorPage';
import type { Product } from '../../types/store';

export function StoreContainer() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [reportingProduct, setReportingProduct] = useState<Product | null>(null);

  // Route: /developers
  if (path.startsWith('/developers')) {
    return <DeveloperPortal />;
  }

  // Route: /store/bots/editor/:botId
  if (path.startsWith('/store/bots/editor/')) {
    return <BotEditorPage />;
  }

  // Route: /store/bots/:slug
  if (path.startsWith('/store/bots/') && path !== '/store/bots' && path !== '/store/bots/') {
    return <BotDetailPage />;
  }

  // Route: /store/bots
  if (path === '/store/bots' || path === '/store/bots/') {
    return <BotCatalogPage />;
  }

  // Route: /store/admin
  if (path === '/store/admin' || path.startsWith('/store/admin/')) {
    return <StoreAdminQueue />;
  }

  // Route: /store/editor/:productId
  if (path.startsWith('/store/editor/')) {
    return <ProductEditorPage />;
  }

  // Route: /store/seller/:sellerSlug
  if (path.startsWith('/store/seller/') && path !== '/store/seller' && path !== '/store/seller/') {
    return <SellerProfilePage />;
  }

  // Route: /store/seller
  if (path === '/store/seller' || path === '/store/seller/') {
    return <SellerDashboard />;
  }

  // Route: /store/product/:slug
  if (path.startsWith('/store/product/')) {
    return (
      <>
        <ProductDetailPage onReportProduct={(prod) => setReportingProduct(prod)} />
        {reportingProduct && (
          <ReportProductModal product={reportingProduct} onClose={() => setReportingProduct(null)} />
        )}
      </>
    );
  }

  // Default: StoreFrontPage
  return (
    <>
      <StoreFrontPage
        onOpenSellerModal={() => setSellerModalOpen(true)}
        onOpenAdminQueue={() => navigate('/store/admin')}
      />
      {sellerModalOpen && (
        <SellerApplyModal onClose={() => setSellerModalOpen(false)} />
      )}
      {reportingProduct && (
        <ReportProductModal product={reportingProduct} onClose={() => setReportingProduct(null)} />
      )}
    </>
  );
}
