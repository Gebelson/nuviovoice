import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { eq, and, desc, asc, like, or, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { authenticate, requireAdmin } from '../utils/auth.js';
import { sendError } from '../utils/httpErrors.js';
import { sanitizeUser } from '../utils/sanitize.js';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function storeRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb();

  // ─── PUBLIC: CATEGORIES ──────────────────────────────────────────────────
  app.get('/api/store/categories', async () => {
    const categories = db
      .select()
      .from(schema.productCategories)
      .orderBy(asc(schema.productCategories.sortOrder))
      .all();
    return { categories };
  });

  // ─── PUBLIC: PRODUCTS CATALOG ────────────────────────────────────────────
  app.get<{
    Querystring: {
      search?: string;
      category?: string;
      productType?: string;
      sort?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
      limit?: string;
      offset?: string;
    };
  }>('/api/store/products', async (request) => {
    const { search, category, productType, sort = 'featured', limit = '24', offset = '0' } = request.query;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 60);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    let query = db
      .select({
        product: schema.products,
        seller: {
          id: schema.sellers.id,
          storeName: schema.sellers.storeName,
          slug: schema.sellers.slug,
          avatar: schema.sellers.avatar,
          status: schema.sellers.status,
        },
        category: {
          id: schema.productCategories.id,
          name: schema.productCategories.name,
          slug: schema.productCategories.slug,
          icon: schema.productCategories.icon,
        },
      })
      .from(schema.products)
      .innerJoin(schema.sellers, eq(schema.products.sellerId, schema.sellers.id))
      .leftJoin(schema.productCategories, eq(schema.products.categoryId, schema.productCategories.id))
      .where(
        and(
          eq(schema.products.status, 'published'),
          eq(schema.sellers.status, 'approved'),
          category ? eq(schema.productCategories.slug, category) : undefined,
          productType ? eq(schema.products.productType, productType) : undefined,
          search
            ? or(
                like(schema.products.title, `%${search}%`),
                like(schema.products.shortDescription, `%${search}%`)
              )
            : undefined
        )
      );

    if (sort === 'newest') {
      query = query.orderBy(desc(schema.products.createdAt)) as any;
    } else if (sort === 'price_asc') {
      query = query.orderBy(asc(schema.products.price)) as any;
    } else if (sort === 'price_desc') {
      query = query.orderBy(desc(schema.products.price)) as any;
    } else if (sort === 'rating') {
      query = query.orderBy(desc(schema.products.rating), desc(schema.products.ratingCount)) as any;
    } else {
      // Featured: high rating + sales count + recent
      query = query.orderBy(desc(schema.products.salesCount), desc(schema.products.rating), desc(schema.products.createdAt)) as any;
    }

    const items = query.limit(lim).offset(off).all();

    return {
      products: items.map((r) => ({
        ...r.product,
        images: JSON.parse(r.product.images || '[]'),
        seller: r.seller,
        category: r.category,
      })),
      limit: lim,
      offset: off,
    };
  });

  // ─── PUBLIC: PRODUCT DETAIL ──────────────────────────────────────────────
  app.get<{
    Params: { slug: string };
  }>('/api/store/products/:slug', async (request, reply) => {
    const { slug } = request.params;

    const row = db
      .select({
        product: schema.products,
        seller: {
          id: schema.sellers.id,
          userId: schema.sellers.userId,
          storeName: schema.sellers.storeName,
          slug: schema.sellers.slug,
          avatar: schema.sellers.avatar,
          banner: schema.sellers.banner,
          bio: schema.sellers.bio,
          status: schema.sellers.status,
        },
        category: {
          id: schema.productCategories.id,
          name: schema.productCategories.name,
          slug: schema.productCategories.slug,
          icon: schema.productCategories.icon,
        },
      })
      .from(schema.products)
      .innerJoin(schema.sellers, eq(schema.products.sellerId, schema.sellers.id))
      .leftJoin(schema.productCategories, eq(schema.products.categoryId, schema.productCategories.id))
      .where(eq(schema.products.slug, slug))
      .get();

    if (!row) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    // Get the published revision layout, or latest revision if seller/admin previewing
    let revision = null;
    if (row.product.publishedRevisionId) {
      revision = db
        .select()
        .from(schema.productRevisions)
        .where(eq(schema.productRevisions.id, row.product.publishedRevisionId))
        .get();
    } else {
      // Fallback to latest revision
      revision = db
        .select()
        .from(schema.productRevisions)
        .where(eq(schema.productRevisions.productId, row.product.id))
        .orderBy(desc(schema.productRevisions.createdAt))
        .limit(1)
        .get();
    }

    return {
      product: {
        ...row.product,
        images: JSON.parse(row.product.images || '[]'),
        seller: row.seller,
        category: row.category,
        layoutData: revision ? JSON.parse(revision.layoutData || '[]') : [],
        customCss: revision?.customCss || '',
      },
    };
  });

  // ─── PUBLIC: SELLER PROFILE ──────────────────────────────────────────────
  app.get<{
    Params: { slug: string };
  }>('/api/store/sellers/:slug', async (request, reply) => {
    const { slug } = request.params;
    const seller = db
      .select()
      .from(schema.sellers)
      .where(eq(schema.sellers.slug, slug))
      .get();

    if (!seller || seller.status === 'suspended') {
      return sendError(reply, 404, 'not_found', { reason: 'seller_not_found' });
    }

    const sellerProducts = db
      .select({
        product: schema.products,
        category: {
          id: schema.productCategories.id,
          name: schema.productCategories.name,
          slug: schema.productCategories.slug,
          icon: schema.productCategories.icon,
        },
      })
      .from(schema.products)
      .leftJoin(schema.productCategories, eq(schema.products.categoryId, schema.productCategories.id))
      .where(
        and(
          eq(schema.products.sellerId, seller.id),
          eq(schema.products.status, 'published')
        )
      )
      .orderBy(desc(schema.products.createdAt))
      .all();

    return {
      seller: {
        id: seller.id,
        storeName: seller.storeName,
        slug: seller.slug,
        bio: seller.bio,
        avatar: seller.avatar,
        banner: seller.banner,
        status: seller.status,
        createdAt: seller.createdAt,
      },
      products: sellerProducts.map((p) => ({
        ...p.product,
        images: JSON.parse(p.product.images || '[]'),
        category: p.category,
      })),
    };
  });

  // ─── AUTH: CURRENT USER SELLER PROFILE ────────────────────────────────────
  app.get('/api/store/sellers/me', { preHandler: authenticate }, async (request) => {
    const seller = db
      .select()
      .from(schema.sellers)
      .where(eq(schema.sellers.userId, request.userId))
      .get();
    return { seller: seller || null };
  });

  // ─── AUTH: APPLY TO BECOME A SELLER ──────────────────────────────────────
  app.post<{
    Body: { storeName: string; slug?: string; bio?: string; contactEmail?: string };
  }>('/api/store/sellers/apply', { preHandler: authenticate }, async (request, reply) => {
    const { storeName, slug: candidateSlug, bio = '', contactEmail } = request.body || {};
    if (!storeName || !storeName.trim()) {
      return sendError(reply, 400, 'validation_failed', { reason: 'invalid_store_name' });
    }

    const existing = db
      .select()
      .from(schema.sellers)
      .where(eq(schema.sellers.userId, request.userId))
      .get();

    if (existing) {
      return reply.code(200).send({ seller: existing });
    }

    let finalSlug = slugify(candidateSlug || storeName);
    if (!finalSlug) finalSlug = `seller-${request.userId.slice(0, 6)}`;

    // Check slug collision
    const slugTaken = db.select().from(schema.sellers).where(eq(schema.sellers.slug, finalSlug)).get();
    if (slugTaken) {
      finalSlug = `${finalSlug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const now = Date.now();
    const id = crypto.randomUUID();

    // Auto-approve seller profile so user can immediately build and draft products
    // (Products themselves still strictly require staff approval before going live!)
    db.insert(schema.sellers)
      .values({
        id,
        userId: request.userId,
        storeName: storeName.trim(),
        slug: finalSlug,
        bio: bio.trim(),
        avatar: null,
        banner: null,
        status: 'approved',
        contactEmail: contactEmail?.trim() || null,
        reviewNotes: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = db.select().from(schema.sellers).where(eq(schema.sellers.id, id)).get();
    return reply.code(201).send({ seller: created });
  });

  // ─── AUTH: UPDATE SELLER PROFILE ─────────────────────────────────────────
  app.put<{
    Body: { storeName?: string; bio?: string; avatar?: string | null; banner?: string | null; contactEmail?: string | null };
  }>('/api/store/sellers/me', { preHandler: authenticate }, async (request, reply) => {
    const seller = db
      .select()
      .from(schema.sellers)
      .where(eq(schema.sellers.userId, request.userId))
      .get();

    if (!seller) {
      return sendError(reply, 404, 'not_found', { reason: 'seller_not_found' });
    }

    const { storeName, bio, avatar, banner, contactEmail } = request.body || {};
    const updates: Partial<typeof schema.sellers.$inferInsert> = {
      updatedAt: Date.now(),
    };

    if (typeof storeName === 'string' && storeName.trim()) updates.storeName = storeName.trim();
    if (typeof bio === 'string') updates.bio = bio.trim();
    if (avatar !== undefined) updates.avatar = avatar;
    if (banner !== undefined) updates.banner = banner;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail;

    db.update(schema.sellers)
      .set(updates)
      .where(eq(schema.sellers.id, seller.id))
      .run();

    const updated = db.select().from(schema.sellers).where(eq(schema.sellers.id, seller.id)).get();
    return { seller: updated };
  });

  // ─── AUTH: SELLER'S OWN PRODUCTS ─────────────────────────────────────────
  app.get('/api/store/seller/products', { preHandler: authenticate }, async (request, reply) => {
    const seller = db
      .select()
      .from(schema.sellers)
      .where(eq(schema.sellers.userId, request.userId))
      .get();

    if (!seller) {
      return { products: [] };
    }

    const items = db
      .select({
        product: schema.products,
        category: {
          id: schema.productCategories.id,
          name: schema.productCategories.name,
          slug: schema.productCategories.slug,
          icon: schema.productCategories.icon,
        },
      })
      .from(schema.products)
      .leftJoin(schema.productCategories, eq(schema.products.categoryId, schema.productCategories.id))
      .where(eq(schema.products.sellerId, seller.id))
      .orderBy(desc(schema.products.updatedAt))
      .all();

    return {
      products: items.map((r) => ({
        ...r.product,
        images: JSON.parse(r.product.images || '[]'),
        category: r.category,
      })),
    };
  });

  // ─── AUTH: CREATE PRODUCT ────────────────────────────────────────────────
  app.post<{
    Body: {
      title: string;
      slug?: string;
      categoryId?: string | null;
      shortDescription?: string;
      productType?: 'digital' | 'physical' | 'service';
      price?: number;
      currency?: string;
      thumbnail?: string | null;
      images?: string[];
      layoutData?: any[];
      customCss?: string;
    };
  }>('/api/store/seller/products', { preHandler: authenticate }, async (request, reply) => {
    const seller = db
      .select()
      .from(schema.sellers)
      .where(eq(schema.sellers.userId, request.userId))
      .get();

    if (!seller) {
      return sendError(reply, 403, 'forbidden', { reason: 'not_a_seller' });
    }
    if (seller.status !== 'approved') {
      return sendError(reply, 403, 'forbidden', { reason: 'seller_not_approved' });
    }

    const {
      title,
      slug: candidateSlug,
      categoryId,
      shortDescription = '',
      productType = 'digital',
      price = 0,
      currency = 'BRL',
      thumbnail = null,
      images = [],
      layoutData = [],
      customCss = '',
    } = request.body || {};

    if (!title || !title.trim()) {
      return sendError(reply, 400, 'validation_failed', { reason: 'invalid_title' });
    }

    let finalSlug = slugify(candidateSlug || title);
    if (!finalSlug) finalSlug = `product-${crypto.randomBytes(3).toString('hex')}`;

    const slugTaken = db.select().from(schema.products).where(eq(schema.products.slug, finalSlug)).get();
    if (slugTaken) {
      finalSlug = `${finalSlug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const now = Date.now();
    const productId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();

    db.insert(schema.products)
      .values({
        id: productId,
        sellerId: seller.id,
        categoryId: categoryId || null,
        title: title.trim(),
        slug: finalSlug,
        shortDescription: shortDescription.trim(),
        productType,
        price: Number(price) || 0,
        currency,
        thumbnail,
        images: JSON.stringify(images),
        status: 'draft',
        publishedRevisionId: null,
        salesCount: 0,
        rating: 5.0,
        ratingCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Create initial revision
    db.insert(schema.productRevisions)
      .values({
        id: revisionId,
        productId,
        version: 1,
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        price: Number(price) || 0,
        currency,
        thumbnail,
        images: JSON.stringify(images),
        layoutData: JSON.stringify(layoutData),
        customCss,
        status: 'draft',
        reviewNotes: null,
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const created = db.select().from(schema.products).where(eq(schema.products.id, productId)).get();
    return reply.code(201).send({
      product: {
        ...created,
        images: JSON.parse(created?.images || '[]'),
        layoutData,
        customCss,
      },
    });
  });

  // ─── AUTH: GET PRODUCT DETAILS FOR EDITING (SELLER OR ADMIN) ─────────────
  app.get<{
    Params: { id: string };
  }>('/api/store/seller/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    const seller = db.select().from(schema.sellers).where(eq(schema.sellers.id, product.sellerId)).get();
    const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
    const isOwner = seller?.userId === request.userId;
    const isAdmin = user?.isAdmin === 1;

    if (!isOwner && !isAdmin) {
      return sendError(reply, 403, 'forbidden');
    }

    // Get all revisions
    const revisions = db
      .select()
      .from(schema.productRevisions)
      .where(eq(schema.productRevisions.productId, id))
      .orderBy(desc(schema.productRevisions.createdAt))
      .all();

    const latestRevision = revisions[0] || null;

    return {
      product: {
        ...product,
        images: JSON.parse(product.images || '[]'),
      },
      latestRevision: latestRevision
        ? {
            ...latestRevision,
            images: JSON.parse(latestRevision.images || '[]'),
            layoutData: JSON.parse(latestRevision.layoutData || '[]'),
          }
        : null,
      revisions: revisions.map((r) => ({
        id: r.id,
        version: r.version,
        title: r.title,
        status: r.status,
        reviewNotes: r.reviewNotes,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
      })),
    };
  });

  // ─── AUTH: UPDATE PRODUCT & DRAFT REVISION ────────────────────────────────
  app.put<{
    Params: { id: string };
    Body: {
      title?: string;
      shortDescription?: string;
      categoryId?: string | null;
      productType?: 'digital' | 'physical' | 'service';
      price?: number;
      currency?: string;
      thumbnail?: string | null;
      images?: string[];
      layoutData?: any[];
      customCss?: string;
    };
  }>('/api/store/seller/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    const seller = db.select().from(schema.sellers).where(eq(schema.sellers.id, product.sellerId)).get();
    const user = db.select().from(schema.users).where(eq(schema.users.id, request.userId)).get();
    if (seller?.userId !== request.userId && user?.isAdmin !== 1) {
      return sendError(reply, 403, 'forbidden');
    }

    const body = request.body || {};
    const now = Date.now();

    // Find the latest revision
    const latestRevision = db
      .select()
      .from(schema.productRevisions)
      .where(eq(schema.productRevisions.productId, id))
      .orderBy(desc(schema.productRevisions.createdAt))
      .limit(1)
      .get();

    let targetRevisionId: string;

    // If latest revision is pending_review or approved (live), create a new draft revision
    if (!latestRevision || latestRevision.status === 'pending_review' || latestRevision.status === 'approved') {
      targetRevisionId = crypto.randomUUID();
      const nextVersion = (latestRevision?.version || 0) + 1;
      db.insert(schema.productRevisions)
        .values({
          id: targetRevisionId,
          productId: id,
          version: nextVersion,
          title: body.title?.trim() || product.title,
          shortDescription: body.shortDescription !== undefined ? body.shortDescription.trim() : product.shortDescription,
          price: body.price !== undefined ? Number(body.price) || 0 : product.price,
          currency: body.currency || product.currency,
          thumbnail: body.thumbnail !== undefined ? body.thumbnail : product.thumbnail,
          images: body.images ? JSON.stringify(body.images) : product.images,
          layoutData: body.layoutData ? JSON.stringify(body.layoutData) : (latestRevision?.layoutData || '[]'),
          customCss: body.customCss !== undefined ? body.customCss : (latestRevision?.customCss || ''),
          status: 'draft',
          reviewNotes: null,
          submittedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } else {
      // Update existing draft / changes_requested revision
      targetRevisionId = latestRevision.id;
      const revUpdates: Partial<typeof schema.productRevisions.$inferInsert> = {
        updatedAt: now,
      };
      if (body.title) revUpdates.title = body.title.trim();
      if (body.shortDescription !== undefined) revUpdates.shortDescription = body.shortDescription.trim();
      if (body.price !== undefined) revUpdates.price = Number(body.price) || 0;
      if (body.currency) revUpdates.currency = body.currency;
      if (body.thumbnail !== undefined) revUpdates.thumbnail = body.thumbnail;
      if (body.images) revUpdates.images = JSON.stringify(body.images);
      if (body.layoutData) revUpdates.layoutData = JSON.stringify(body.layoutData);
      if (body.customCss !== undefined) revUpdates.customCss = body.customCss;
      if (latestRevision.status === 'changes_requested') revUpdates.status = 'draft';

      db.update(schema.productRevisions)
        .set(revUpdates)
        .where(eq(schema.productRevisions.id, targetRevisionId))
        .run();
    }

    // Update product base fields
    const productUpdates: Partial<typeof schema.products.$inferInsert> = {
      updatedAt: now,
    };
    if (body.title) productUpdates.title = body.title.trim();
    if (body.shortDescription !== undefined) productUpdates.shortDescription = body.shortDescription.trim();
    if (body.categoryId !== undefined) productUpdates.categoryId = body.categoryId;
    if (body.productType) productUpdates.productType = body.productType;
    if (body.thumbnail !== undefined) productUpdates.thumbnail = body.thumbnail;
    if (body.images) productUpdates.images = JSON.stringify(body.images);

    // If product is in draft or changes_requested and not yet published, update its price directly too
    if (product.status === 'draft' || product.status === 'changes_requested') {
      if (body.price !== undefined) productUpdates.price = Number(body.price) || 0;
      if (body.currency) productUpdates.currency = body.currency;
    }

    db.update(schema.products)
      .set(productUpdates)
      .where(eq(schema.products.id, id))
      .run();

    const updatedProduct = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    const updatedRevision = db.select().from(schema.productRevisions).where(eq(schema.productRevisions.id, targetRevisionId)).get();

    return {
      product: {
        ...updatedProduct,
        images: JSON.parse(updatedProduct?.images || '[]'),
      },
      latestRevision: {
        ...updatedRevision,
        images: JSON.parse(updatedRevision?.images || '[]'),
        layoutData: JSON.parse(updatedRevision?.layoutData || '[]'),
      },
    };
  });

  // ─── AUTH: SUBMIT PRODUCT FOR MODERATION REVIEW ──────────────────────────
  app.post<{
    Params: { id: string };
  }>('/api/store/seller/products/:id/submit', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    const seller = db.select().from(schema.sellers).where(eq(schema.sellers.id, product.sellerId)).get();
    if (seller?.userId !== request.userId) {
      return sendError(reply, 403, 'forbidden');
    }

    const latestRevision = db
      .select()
      .from(schema.productRevisions)
      .where(eq(schema.productRevisions.productId, id))
      .orderBy(desc(schema.productRevisions.createdAt))
      .limit(1)
      .get();

    if (!latestRevision) {
      return sendError(reply, 400, 'validation_failed', { reason: 'no_revision_to_submit' });
    }

    const now = Date.now();

    // Update revision status to pending_review
    db.update(schema.productRevisions)
      .set({
        status: 'pending_review',
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.productRevisions.id, latestRevision.id))
      .run();

    // If product has never been published, set product status to pending_review
    // If it is already published, keep product published while revision waits in queue!
    if (product.status !== 'published') {
      db.update(schema.products)
        .set({
          status: 'pending_review',
          updatedAt: now,
        })
        .where(eq(schema.products.id, id))
        .run();
    }

    return {
      success: true,
      revisionId: latestRevision.id,
      status: 'pending_review',
    };
  });

  // ─── AUTH ADMIN: QUEUE OF PENDING REVISIONS & MODERATION ──────────────────
  app.get('/api/store/admin/queue', { preHandler: [authenticate, requireAdmin] }, async () => {
    // Pending revisions
    const pendingRevisions = db
      .select({
        revision: schema.productRevisions,
        product: schema.products,
        seller: schema.sellers,
      })
      .from(schema.productRevisions)
      .innerJoin(schema.products, eq(schema.productRevisions.productId, schema.products.id))
      .innerJoin(schema.sellers, eq(schema.products.sellerId, schema.sellers.id))
      .where(eq(schema.productRevisions.status, 'pending_review'))
      .orderBy(asc(schema.productRevisions.submittedAt))
      .all();

    // Pending reports
    const pendingReports = db
      .select({
        report: schema.productReports,
        product: schema.products,
        reporter: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        },
      })
      .from(schema.productReports)
      .innerJoin(schema.products, eq(schema.productReports.productId, schema.products.id))
      .innerJoin(schema.users, eq(schema.productReports.reporterId, schema.users.id))
      .where(eq(schema.productReports.status, 'pending'))
      .orderBy(desc(schema.productReports.createdAt))
      .all();

    return {
      revisions: pendingRevisions.map((r) => ({
        ...r.revision,
        images: JSON.parse(r.revision.images || '[]'),
        layoutData: JSON.parse(r.revision.layoutData || '[]'),
        product: r.product,
        seller: r.seller,
      })),
      reports: pendingReports,
    };
  });

  // ─── AUTH ADMIN: REVIEW REVISION (APPROVE / REJECT / CHANGES_REQUESTED) ──
  app.post<{
    Params: { id: string };
    Body: { action: 'approve' | 'reject' | 'changes_requested'; notes?: string };
  }>('/api/store/admin/revisions/:id/review', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { action, notes = '' } = request.body || {};

    const revision = db.select().from(schema.productRevisions).where(eq(schema.productRevisions.id, id)).get();
    if (!revision) {
      return sendError(reply, 404, 'not_found', { reason: 'revision_not_found' });
    }

    const product = db.select().from(schema.products).where(eq(schema.products.id, revision.productId)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    const now = Date.now();

    if (action === 'approve') {
      // Approve revision
      db.update(schema.productRevisions)
        .set({
          status: 'approved',
          reviewNotes: notes.trim() || null,
          reviewedAt: now,
          reviewedBy: request.userId,
          updatedAt: now,
        })
        .where(eq(schema.productRevisions.id, id))
        .run();

      // Publish product with the approved revision details
      db.update(schema.products)
        .set({
          title: revision.title,
          shortDescription: revision.shortDescription,
          price: revision.price,
          currency: revision.currency,
          thumbnail: revision.thumbnail,
          images: revision.images,
          status: 'published',
          publishedRevisionId: id,
          updatedAt: now,
        })
        .where(eq(schema.products.id, product.id))
        .run();
    } else if (action === 'reject') {
      db.update(schema.productRevisions)
        .set({
          status: 'rejected',
          reviewNotes: notes.trim() || null,
          reviewedAt: now,
          reviewedBy: request.userId,
          updatedAt: now,
        })
        .where(eq(schema.productRevisions.id, id))
        .run();

      // If product had no previous approved revision, mark product rejected
      if (!product.publishedRevisionId) {
        db.update(schema.products)
          .set({ status: 'rejected', updatedAt: now })
          .where(eq(schema.products.id, product.id))
          .run();
      }
    } else if (action === 'changes_requested') {
      db.update(schema.productRevisions)
        .set({
          status: 'changes_requested',
          reviewNotes: notes.trim() || null,
          reviewedAt: now,
          reviewedBy: request.userId,
          updatedAt: now,
        })
        .where(eq(schema.productRevisions.id, id))
        .run();

      if (!product.publishedRevisionId) {
        db.update(schema.products)
          .set({ status: 'changes_requested', updatedAt: now })
          .where(eq(schema.products.id, product.id))
          .run();
      }
    } else {
      return sendError(reply, 400, 'validation_failed', { reason: 'invalid_review_action' });
    }

    return { success: true, action, revisionId: id };
  });

  // ─── AUTH ADMIN: SUSPEND / PUBLISH / ARCHIVE PRODUCT ──────────────────────
  app.post<{
    Params: { id: string };
    Body: { status: 'published' | 'suspended' | 'archived'; reason?: string };
  }>('/api/store/admin/products/:id/status', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { status } = request.body || {};

    const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    db.update(schema.products)
      .set({ status, updatedAt: Date.now() })
      .where(eq(schema.products.id, id))
      .run();

    return { success: true, status };
  });

  // ─── AUTH: FAVORITES ─────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
  }>('/api/store/favorites/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    try {
      db.insert(schema.productFavorites)
        .values({
          userId: request.userId,
          productId: id,
          createdAt: Date.now(),
        })
        .run();
    } catch {
      // Already favorited
    }

    return { favorited: true };
  });

  app.delete<{
    Params: { id: string };
  }>('/api/store/favorites/:id', { preHandler: authenticate }, async (request) => {
    const { id } = request.params;
    db.delete(schema.productFavorites)
      .where(
        and(
          eq(schema.productFavorites.userId, request.userId),
          eq(schema.productFavorites.productId, id)
        )
      )
      .run();
    return { favorited: false };
  });

  app.get('/api/store/favorites', { preHandler: authenticate }, async (request) => {
    const items = db
      .select({
        product: schema.products,
        seller: {
          id: schema.sellers.id,
          storeName: schema.sellers.storeName,
          slug: schema.sellers.slug,
          avatar: schema.sellers.avatar,
        },
        category: {
          id: schema.productCategories.id,
          name: schema.productCategories.name,
          slug: schema.productCategories.slug,
          icon: schema.productCategories.icon,
        },
      })
      .from(schema.productFavorites)
      .innerJoin(schema.products, eq(schema.productFavorites.productId, schema.products.id))
      .innerJoin(schema.sellers, eq(schema.products.sellerId, schema.sellers.id))
      .leftJoin(schema.productCategories, eq(schema.products.categoryId, schema.productCategories.id))
      .where(eq(schema.productFavorites.userId, request.userId))
      .orderBy(desc(schema.productFavorites.createdAt))
      .all();

    return {
      products: items.map((r) => ({
        ...r.product,
        images: JSON.parse(r.product.images || '[]'),
        seller: r.seller,
        category: r.category,
      })),
    };
  });

  // ─── AUTH: REPORT PRODUCT ────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { reason: string; details?: string };
  }>('/api/store/products/:id/report', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { reason, details = '' } = request.body || {};

    if (!reason || !reason.trim()) {
      return sendError(reply, 400, 'validation_failed', { reason: 'invalid_reason' });
    }

    const product = db.select().from(schema.products).where(eq(schema.products.id, id)).get();
    if (!product) {
      return sendError(reply, 404, 'not_found', { reason: 'product_not_found' });
    }

    const reportId = crypto.randomUUID();
    db.insert(schema.productReports)
      .values({
        id: reportId,
        productId: id,
        reporterId: request.userId,
        reason: reason.trim(),
        details: details.trim(),
        status: 'pending',
        actionTaken: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: Date.now(),
      })
      .run();

    return reply.code(201).send({ success: true, reportId });
  });

  // ─── AUTH ADMIN: RESOLVE REPORT ──────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { action: 'dismiss' | 'suspend_product'; details?: string };
  }>('/api/store/admin/reports/:id/resolve', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { action, details } = request.body || {};

    const report = db.select().from(schema.productReports).where(eq(schema.productReports.id, id)).get();
    if (!report) {
      return sendError(reply, 404, 'not_found', { reason: 'report_not_found' });
    }

    const now = Date.now();
    if (action === 'suspend_product') {
      db.update(schema.products)
        .set({ status: 'suspended', updatedAt: now })
        .where(eq(schema.products.id, report.productId))
        .run();
    }

    db.update(schema.productReports)
      .set({
        status: action === 'dismiss' ? 'dismissed' : 'resolved',
        actionTaken: action,
        resolvedBy: request.userId,
        resolvedAt: now,
      })
      .where(eq(schema.productReports.id, id))
      .run();

    return { success: true };
  });
}
