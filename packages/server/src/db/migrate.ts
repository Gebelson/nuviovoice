import Database from 'better-sqlite3';
import crypto from 'crypto';
import { insertDmMember } from '../utils/dmMemberClosed.js';

/**
 * Ensure data invariants after schema migration. Idempotent — safe to run
 * on every boot. Uses raw better-sqlite3 handle (not Drizzle ORM).
 */
export function ensureDefaults(db: Database.Database): void {
  // 1. Ensure the single-row instance_settings row exists
  const row = db.prepare('SELECT id FROM instance_settings WHERE id = 1').get();
  if (!row) {
    db.prepare(
      `INSERT OR IGNORE INTO instance_settings
        (id, max_bitrate_kbps, min_bitrate_kbps, bitrate_step_kbps,
         allowed_resolutions, allowed_framerates, max_resolution, max_framerate, updated_at)
       VALUES (1, 20000, 500, 500, ?, ?, 1080, 60, ?)`
    ).run('540,720,1080', '30,45,60', Date.now());
    console.log('[defaults] Inserted default instance_settings row');
  }

  // 2. Ensure a unique Snowflake worker ID is persisted (0-1023)
  const settings = db.prepare('SELECT worker_id FROM instance_settings WHERE id = 1').get() as
    { worker_id: number | null } | undefined;
  if (!settings || settings.worker_id === null) {
    const workerId = crypto.randomInt(0, 1024);
    db.prepare('UPDATE instance_settings SET worker_id = ? WHERE id = 1').run(workerId);
    console.log(`[defaults] Generated Snowflake worker ID: ${workerId}`);
  }

  // 2b. Ensure a persistent instance epoch (incarnation UUID) exists. A fresh
  // DB mints a new one — this is the discriminator for detecting resets.
  // The id=1 row is guaranteed by step 1's INSERT OR IGNORE above.
  const epochRow = db.prepare('SELECT instance_id FROM instance_settings WHERE id = 1').get() as
    { instance_id: string | null } | undefined;
  if (!epochRow || epochRow.instance_id === null) {
    const instanceId = crypto.randomUUID();
    const res = db.prepare('UPDATE instance_settings SET instance_id = ? WHERE id = 1').run(instanceId);
    if (res.changes !== 1) throw new Error('ensureDefaults: instance_settings id=1 row missing — cannot mint epoch');
    console.log('[defaults] Generated instance epoch');
  }

  // 2c. Ensure installed_at is set. Existing databases get the oldest local
  // account's creation time, a fresh one gets now. Never overwritten.
  const installedRow = db.prepare('SELECT installed_at FROM instance_settings WHERE id = 1').get() as
    { installed_at: number | null } | undefined;
  if (!installedRow || installedRow.installed_at === null) {
    const oldest = db.prepare(
      'SELECT created_at FROM users WHERE home_instance IS NULL AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at ASC LIMIT 1',
    ).get() as { created_at: number } | undefined;
    const installedAt = oldest?.created_at ?? Date.now();
    db.prepare('UPDATE instance_settings SET installed_at = ? WHERE id = 1').run(installedAt);
    console.log('[defaults] Recorded installed_at');
  }

  // 3. Ensure at least one admin exists (promote earliest registered user)
  const anyAdmin = db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get();
  if (!anyAdmin) {
    const firstUser = db.prepare(
      'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
    ).get() as { id: string } | undefined;
    if (firstUser) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUser.id);
      console.log(`[defaults] Promoted first user ${firstUser.id} to admin`);
    }
  }

  // 4. Ensure voice_invites table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_invites (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      revoked_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_invites_token ON voice_invites(token);
    CREATE INDEX IF NOT EXISTS idx_voice_invites_space_id ON voice_invites(space_id);
    CREATE INDEX IF NOT EXISTS idx_voice_invites_channel_id ON voice_invites(channel_id);
  `);

  // 5. Ensure Marketplace / Store tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sellers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      store_name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      bio TEXT DEFAULT '',
      avatar TEXT,
      banner TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      contact_email TEXT,
      review_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_slug ON sellers(slug);
    CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);

    CREATE TABLE IF NOT EXISTS product_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'Package',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories(slug);
    CREATE INDEX IF NOT EXISTS idx_product_categories_sort ON product_categories(sort_order);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES product_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_description TEXT DEFAULT '',
      product_type TEXT NOT NULL DEFAULT 'digital',
      price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      thumbnail TEXT,
      images TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      published_revision_id TEXT,
      sales_count INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 5.0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

    CREATE TABLE IF NOT EXISTS product_revisions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      short_description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      thumbnail TEXT,
      images TEXT DEFAULT '[]',
      layout_data TEXT NOT NULL DEFAULT '[]',
      custom_css TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      review_notes TEXT,
      submitted_at INTEGER,
      reviewed_at INTEGER,
      reviewed_by TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_product_revisions_product_id ON product_revisions(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_revisions_status ON product_revisions(status);

    CREATE TABLE IF NOT EXISTS product_favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_product_favorites_user_id ON product_favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_product_favorites_product_id ON product_favorites(product_id);

    CREATE TABLE IF NOT EXISTS product_reports (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      details TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      action_taken TEXT,
      resolved_by TEXT REFERENCES users(id),
      resolved_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_product_reports_product_id ON product_reports(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_reports_reporter_id ON product_reports(reporter_id);
    CREATE INDEX IF NOT EXISTS idx_product_reports_status ON product_reports(status);
  `);

  // Seed default product categories if none exist
  const catCount = db.prepare('SELECT COUNT(*) as count FROM product_categories').get() as { count: number };
  if (!catCount || catCount.count === 0) {
    const insertCat = db.prepare(`
      INSERT INTO product_categories (id, name, slug, description, icon, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const defaultCats = [
      { id: 'cat-bots', name: 'Bots & Integrações', slug: 'bots', description: 'Bots para espaços, webhooks e automações', icon: 'Bot', sort: 1 },
      { id: 'cat-servicos', name: 'Serviços & Design', slug: 'servicos', description: 'Configuração de espaços, moderação e identidade visual', icon: 'Sparkles', sort: 2 },
      { id: 'cat-arte', name: 'Arte & Emojis', slug: 'arte', description: 'Pacotes de emojis, ícones, banners e ilustrações', icon: 'Palette', sort: 3 },
      { id: 'cat-templates', name: 'Comunidades & Modelos', slug: 'templates', description: 'Modelos prontos de canais, cargos e permissões', icon: 'LayoutTemplate', sort: 4 },
      { id: 'cat-conteudo', name: 'Cursos & Conteúdo', slug: 'conteudo', description: 'Guias, mentorias e e-books exclusivos', icon: 'GraduationCap', sort: 5 },
      { id: 'cat-outros', name: 'Outros', slug: 'outros', description: 'Outros produtos e utilitários', icon: 'Package', sort: 6 },
    ];
    const now = Date.now();
    for (const cat of defaultCats) {
      insertCat.run(cat.id, cat.name, cat.slug, cat.description, cat.icon, cat.sort, now);
    }
    console.log('[defaults] Seeded default marketplace categories');
  }

  // 6. Ensure dm_members.cleared_history_at exists
  const dmMemberCols = db.prepare('PRAGMA table_info(dm_members)').all() as { name: string }[];
  if (!dmMemberCols.some(c => c.name === 'cleared_history_at')) {
    db.exec('ALTER TABLE dm_members ADD COLUMN cleared_history_at INTEGER DEFAULT 0 NOT NULL;');
    console.log('[defaults] Added cleared_history_at column to dm_members');
  }

  // 7. Ensure user_hidden_messages table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_hidden_messages (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL,
      channel_type TEXT NOT NULL DEFAULT 'dm',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_hidden_messages_user_id ON user_hidden_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_hidden_messages_message_id ON user_hidden_messages(message_id);
  `);

  // 8. Ensure audit_logs table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
      actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      target_id TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_space_id ON audit_logs(space_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
  `);
}

/**
 * One-time, idempotent recovery of 1-on-1 DM threads broken before the DM
 * tombstone fix: those had the deleted partner's dm_members row removed, making
 * the thread UI-unreachable. For each ownerId-NULL channel with exactly one
 * member, re-insert membership for any distinct dm_messages author that is
 * missing from dm_members and still exists in users. Safe to run every boot.
 */
export function backfillOneOnOneDmMembership(db: Database.Database): void {
  const broken = db.prepare(`
    SELECT dc.id AS channelId
    FROM dm_channels dc
    WHERE dc.owner_id IS NULL
      AND (SELECT COUNT(*) FROM dm_members dm WHERE dm.dm_channel_id = dc.id) = 1
  `).all() as { channelId: string }[];
  if (broken.length === 0) return;

  const missingAuthors = db.prepare(`
    SELECT DISTINCT msg.user_id AS userId
    FROM dm_messages msg
    JOIN users u ON u.id = msg.user_id
    WHERE msg.dm_channel_id = ?
      AND msg.user_id NOT IN (SELECT user_id FROM dm_members WHERE dm_channel_id = ?)
  `);

  let restored = 0;
  const run = db.transaction(() => {
    for (const { channelId } of broken) {
      const authors = missingAuthors.all(channelId, channelId) as { userId: string }[];
      for (const { userId } of authors) { insertDmMember(db, channelId, userId); restored++; }
    }
  });
  run();
  if (restored > 0) console.log(`[backfill] restored ${restored} deleted-partner DM membership row(s)`);
}

export function slugifySpaceName(name: string, fallbackId: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const suffix = fallbackId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase() || 'space';
  return base ? `${base}-${suffix}` : `space-${suffix}`;
}

/**
 * Idempotent boot pass that classifies existing spaces into `type = 'public'`
 * (`publication_status = 'published'`) vs `type = 'private'` (`publication_status = 'draft'`)
 * based on their existing visibility, ensuring zero data loss and conservative
 * privacy for ambiguous rows.
 */
export function migrateExistingSpacesSeparation(
  db: Database.Database,
  opts?: { beforeChanges?: () => void },
): number {
  // Find legacy public spaces (`visibility IN ('public', 'request')`) that still have the default `type = 'private'`
  const needsPublicMigration = db.prepare(`
    SELECT id, name, visibility, type, slug, category, publication_status, published_at, created_at
    FROM spaces
    WHERE visibility IN ('public', 'request')
      AND (type IS NULL OR type = 'private')
  `).all() as Array<{
    id: string;
    name: string;
    visibility: string;
    type: string;
    slug: string | null;
    category: string | null;
    publication_status: string;
    published_at: number | null;
    created_at: number;
  }>;

  // Find private spaces (`visibility NOT IN ('public', 'request')` or NULL) that have inconsistent directory_listed or type
  const needsPrivateSanitization = db.prepare(`
    SELECT id
    FROM spaces
    WHERE (visibility IS NULL OR visibility NOT IN ('public', 'request'))
      AND (type != 'private' OR directory_listed != 0 OR visibility IS NULL OR visibility != 'private')
  `).all() as Array<{ id: string }>;

  // Find public spaces that have visibility = 'private' or NULL
  const needsPublicVisibilityFix = db.prepare(`
    SELECT id
    FROM spaces
    WHERE type = 'public' AND (visibility = 'private' OR visibility IS NULL)
  `).all() as Array<{ id: string }>;

  // Find private spaces that have publication_status = 'published'
  const needsPrivatePublicationFix = db.prepare(`
    SELECT id
    FROM spaces
    WHERE type = 'private' AND publication_status = 'published'
  `).all() as Array<{ id: string }>;

  if (
    needsPublicMigration.length === 0 &&
    needsPrivateSanitization.length === 0 &&
    needsPublicVisibilityFix.length === 0 &&
    needsPrivatePublicationFix.length === 0
  ) {
    return 0;
  }

  opts?.beforeChanges?.();

  const updatePublic = db.prepare(`
    UPDATE spaces
    SET type = 'public',
        slug = ?,
        category = COALESCE(category, 'community'),
        publication_status = 'published',
        published_at = COALESCE(published_at, created_at)
    WHERE id = ?
  `);

  const checkSlug = db.prepare(`SELECT id FROM spaces WHERE slug = ? AND id != ? LIMIT 1`);

  const updatePrivate = db.prepare(`
    UPDATE spaces
    SET type = 'private',
        visibility = 'private',
        directory_listed = 0,
        publication_status = 'draft',
        slug = NULL
    WHERE id = ?
  `);

  const fixPublicVisibility = db.prepare(`
    UPDATE spaces
    SET visibility = 'public'
    WHERE id = ?
  `);

  const fixPrivatePublication = db.prepare(`
    UPDATE spaces
    SET publication_status = 'draft',
        directory_listed = 0
    WHERE id = ?
  `);

  let changed = 0;
  const run = db.transaction(() => {
    for (const row of needsPublicMigration) {
      let candidateSlug = row.slug || slugifySpaceName(row.name, row.id);
      if (checkSlug.get(candidateSlug, row.id)) {
        candidateSlug = `${candidateSlug}-${row.id.slice(0, 4).toLowerCase()}`;
      }
      updatePublic.run(candidateSlug, row.id);
      changed++;
    }
    for (const row of needsPrivateSanitization) {
      updatePrivate.run(row.id);
      changed++;
    }
    for (const row of needsPublicVisibilityFix) {
      fixPublicVisibility.run(row.id);
      changed++;
    }
    for (const row of needsPrivatePublicationFix) {
      fixPrivatePublication.run(row.id);
      changed++;
    }
  });
  run();

  if (changed > 0) {
    console.log(`[spaces-migration] classified/updated ${changed} existing space(s) into private/public separation`);
  }
  return changed;
}

