import Database from 'better-sqlite3';
import crypto from 'crypto';
import { insertDmMember } from '../utils/dmMemberClosed.js';
import { OFFICIAL_WINKS } from '@concord/shared/src/winks.js';

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
  const hasDmMembers = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='dm_members'").get();
  if (hasDmMembers) {
    const dmMemberCols = db.prepare('PRAGMA table_info(dm_members)').all() as { name: string }[];
    if (!dmMemberCols.some(c => c.name === 'cleared_history_at')) {
      db.exec('ALTER TABLE dm_members ADD COLUMN cleared_history_at INTEGER DEFAULT 0 NOT NULL;');
      console.log('[defaults] Added cleared_history_at column to dm_members');
    }
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

  // 9. Ensure users.is_bot exists
  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userCols.some(c => c.name === 'is_bot')) {
    db.exec('ALTER TABLE users ADD COLUMN is_bot INTEGER DEFAULT 0 NOT NULL;');
    console.log('[defaults] Added is_bot column to users');
  }

  // 9.1 Ensure users privacy columns (friend_discovery_visibility, receive_winks) exist
  if (!userCols.some(c => c.name === 'friend_discovery_visibility')) {
    db.exec("ALTER TABLE users ADD COLUMN friend_discovery_visibility TEXT DEFAULT 'everyone' NOT NULL;");
    db.exec("UPDATE users SET friend_discovery_visibility = 'nobody' WHERE discoverable = 0;");
    console.log('[defaults] Added friend_discovery_visibility column to users');
  }
  if (!userCols.some(c => c.name === 'receive_winks')) {
    db.exec('ALTER TABLE users ADD COLUMN receive_winks INTEGER DEFAULT 1 NOT NULL;');
    console.log('[defaults] Added receive_winks column to users');
  }

  // 10. Ensure Bot Library tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'Bot',
      sort_order INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_categories_slug ON bot_categories(slug);
    CREATE INDEX IF NOT EXISTS idx_bot_categories_sort ON bot_categories(sort_order);

    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT DEFAULT '' NOT NULL,
      description TEXT DEFAULT '',
      avatar TEXT,
      banner TEXT,
      developer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'draft' NOT NULL,
      is_verified INTEGER DEFAULT 0 NOT NULL,
      is_official INTEGER DEFAULT 0 NOT NULL,
      prefix TEXT DEFAULT '/' NOT NULL,
      website_url TEXT,
      support_url TEXT,
      privacy_policy_url TEXT,
      webhook_url TEXT,
      webhook_secret TEXT,
      bot_token TEXT,
      required_permissions TEXT DEFAULT '[]' NOT NULL,
      tags TEXT DEFAULT '[]' NOT NULL,
      categories TEXT DEFAULT '[]' NOT NULL,
      commands TEXT DEFAULT '[]' NOT NULL,
      layout_data TEXT DEFAULT '[]' NOT NULL,
      custom_css TEXT DEFAULT '',
      install_count INTEGER DEFAULT 0 NOT NULL,
      rating_average REAL DEFAULT 5 NOT NULL,
      rating_count INTEGER DEFAULT 0 NOT NULL,
      version TEXT DEFAULT '1.0.0' NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bots_slug ON bots(slug);
    CREATE INDEX IF NOT EXISTS idx_bots_developer_id ON bots(developer_id);
    CREATE INDEX IF NOT EXISTS idx_bots_bot_user_id ON bots(bot_user_id);
    CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
    CREATE INDEX IF NOT EXISTS idx_bots_install_count ON bots(install_count);
    CREATE INDEX IF NOT EXISTS idx_bots_rating ON bots(rating_average);

    CREATE TABLE IF NOT EXISTS bot_installations (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      installed_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      granted_permissions TEXT DEFAULT '[]' NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      installed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(bot_id, space_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_installations_bot_space ON bot_installations(bot_id, space_id);
    CREATE INDEX IF NOT EXISTS idx_bot_installations_space_id ON bot_installations(space_id);
    CREATE INDEX IF NOT EXISTS idx_bot_installations_bot_id ON bot_installations(bot_id);

    CREATE TABLE IF NOT EXISTS bot_reviews (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT DEFAULT '' NOT NULL,
      developer_reply TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(bot_id, user_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_reviews_bot_user ON bot_reviews(bot_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_bot_reviews_bot_id ON bot_reviews(bot_id);
    CREATE INDEX IF NOT EXISTS idx_bot_reviews_user_id ON bot_reviews(user_id);
  `);

  // 11. Seed default bot categories
  const now = Date.now();
  const botCatCount = (db.prepare('SELECT count(*) as count FROM bot_categories').get() as { count: number }).count;
  if (botCatCount === 0) {
    const defaultBotCategories = [
      { id: 'bcat_mod', name: 'Moderação', slug: 'moderacao', description: 'Proteja seus espaços com moderação automática e ferramentas de segurança.', icon: 'Shield', sort: 1 },
      { id: 'bcat_music', name: 'Música', slug: 'musica', description: 'Ouça músicas em alta fidelidade e gerencie playlists com sua comunidade.', icon: 'Music', sort: 2 },
      { id: 'bcat_fun', name: 'Entretenimento', slug: 'entretenimento', description: 'Memes, minijogos e diversão garantida para os membros.', icon: 'Sparkles', sort: 3 },
      { id: 'bcat_games', name: 'Jogos', slug: 'jogos', description: 'Integrações com games populares, estatísticas e partidas multiplayer.', icon: 'Gamepad2', sort: 4 },
      { id: 'bcat_eco', name: 'Economia', slug: 'economia', description: 'Sistemas de moedas, lojas virtuais, inventários e transações.', icon: 'Coins', sort: 5 },
      { id: 'bcat_xp', name: 'Níveis e XP', slug: 'niveis-xp', description: 'Gamifique a atividade do seu espaço com ranks e recompensas por mensagens.', icon: 'Trophy', sort: 6 },
      { id: 'bcat_welcome', name: 'Boas-vindas', slug: 'boas-vindas', description: 'Receba novos membros com mensagens customizadas e atribuição automática de cargos.', icon: 'UserPlus', sort: 7 },
      { id: 'bcat_tickets', name: 'Tickets e suporte', slug: 'tickets-suporte', description: 'Atendimento privativo, gerenciamento de dúvidas e chamados técnicos.', icon: 'LifeBuoy', sort: 8 },
      { id: 'bcat_utils', name: 'Utilidades', slug: 'utilidades', description: 'Pesquisas, lembretes, previsão do tempo, calculadoras e ferramentas.', icon: 'Wrench', sort: 9 },
      { id: 'bcat_auto', name: 'Automação', slug: 'automacao', description: 'Automatize tarefas repetitivas, webhooks e integrações com serviços externos.', icon: 'Cpu', sort: 10 },
      { id: 'bcat_ai', name: 'Inteligência Artificial', slug: 'inteligencia-artificial', description: 'Assistentes inteligentes, geração de texto e respostas com IA.', icon: 'Bot', sort: 11 },
      { id: 'bcat_comm', name: 'Comunidade', slug: 'comunidade', description: 'Fortaleça laços comunitários com dinâmica de interação e eventos.', icon: 'Users', sort: 12 },
      { id: 'bcat_prod', name: 'Produtividade', slug: 'produtividade', description: 'Quadro de tarefas, agendamentos, notas compartilhadas e metas.', icon: 'CheckSquare', sort: 13 },
      { id: 'bcat_polls', name: 'Enquetes', slug: 'enquetes', description: 'Votações interativas com opções múltiplas e gráficos de resultados.', icon: 'BarChart2', sort: 14 },
      { id: 'bcat_sec', name: 'Segurança', slug: 'seguranca', description: 'Antiraid, verificação de entrada e auditoria de ações suspeitas.', icon: 'Lock', sort: 15 },
    ];

    const insertBotCat = db.prepare(`
      INSERT INTO bot_categories (id, name, slug, description, icon, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of defaultBotCategories) {
      insertBotCat.run(c.id, c.name, c.slug, c.description, c.icon, c.sort, now);
    }
    console.log('[defaults] Seeded default bot categories');
  }

  // 12. Seed official starter bots if table is empty
  const botCount = (db.prepare('SELECT count(*) as count FROM bots').get() as { count: number }).count;
  if (botCount === 0) {
    // Find or create a system developer user
    let dev = db.prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").get() as { id: string } | undefined;
    if (!dev) {
      dev = db.prepare("SELECT id FROM users LIMIT 1").get() as { id: string } | undefined;
      if (!dev) {
        db.prepare(`
          INSERT INTO users (id, username, display_name, password_hash, is_bot, is_admin, created_at)
          VALUES ('system_admin', 'system', 'Nuvio System', 'bot_auth_managed', 0, 1, ?)
        `).run(now);
        dev = { id: 'system_admin' };
      }
    }
    const devId = dev.id;

    // Helper to ensure bot user row exists
    const ensureBotUser = (id: string, username: string, displayName: string, avatar: string) => {
      const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!existing) {
        db.prepare(`
          INSERT INTO users (id, username, display_name, avatar, password_hash, is_bot, is_admin, created_at)
          VALUES (?, ?, ?, ?, 'bot_auth_managed', 1, 0, ?)
        `).run(id, username, displayName, avatar, now);
      }
    };

    ensureBotUser('user_bot_sentinel', 'nuvio_sentinel', 'Nuvio Sentinel', '');
    ensureBotUser('user_bot_welcome', 'nuvio_welcome', 'Nuvio Welcome', '');
    ensureBotUser('user_bot_polls', 'nuvio_polls', 'Nuvio Polls', '');
    ensureBotUser('user_bot_support', 'nuvio_support', 'Nuvio Support', '');
    ensureBotUser('user_bot_level', 'nuvio_level', 'Nuvio Level', '');

    const starterBots = [
      {
        id: 'bot_sentinel',
        slug: 'nuvio-sentinel',
        name: 'Nuvio Sentinel',
        tagline: 'Sistema avançado de moderação automática, antiraid e proteção contra spam.',
        description: 'O Nuvio Sentinel é o bot definitivo para manter seu espaço seguro e amigável. Conta com filtros de palavras ofensivas, detecção de spam em tempo real, proteção contra ataques raid, punições progressivas e registro detalhado de todas as infrações.',
        avatar: '',
        banner: '',
        developerId: devId,
        botUserId: 'user_bot_sentinel',
        status: 'published',
        isVerified: 1,
        isOfficial: 1,
        prefix: '/',
        requiredPermissions: JSON.stringify(['MANAGE_MESSAGES', 'KICK_MEMBERS', 'BAN_MEMBERS', 'VIEW_AUDIT_LOGS']),
        tags: JSON.stringify(['moderacao', 'seguranca', 'antiraid', 'antispam', 'limpar chat', 'ban', 'kick', 'mute']),
        categories: JSON.stringify(['moderacao', 'seguranca', 'automacao']),
        commands: JSON.stringify([
          { name: 'ban', description: 'Bane um usuário do espaço permanentemente.', usage: '/ban @usuario [motivo]' },
          { name: 'kick', description: 'Expulsa um usuário do espaço.', usage: '/kick @usuario [motivo]' },
          { name: 'clear', description: 'Apaga até 100 mensagens do canal.', usage: '/clear [quantidade]' },
          { name: 'slowmode', description: 'Configura o modo lento no canal de texto.', usage: '/slowmode [segundos]' },
          { name: 'lock', description: 'Bloqueia o canal para envio de mensagens.', usage: '/lock' },
        ]),
        installCount: 1420,
        ratingAverage: 4.9,
        ratingCount: 128,
      },
      {
        id: 'bot_welcome',
        slug: 'nuvio-welcome',
        name: 'Nuvio Welcome',
        tagline: 'Boas-vindas personalizadas, atribuição automática de cargos e mensagens de entrada.',
        description: 'Receba novos integrantes com muito estilo! O Nuvio Welcome permite enviar mensagens em canais específicos ou no privado, aplicar cargos automáticos assim que o usuário entra no espaço e criar painéis interativos de regras.',
        avatar: '',
        banner: '',
        developerId: devId,
        botUserId: 'user_bot_welcome',
        status: 'published',
        isVerified: 1,
        isOfficial: 1,
        prefix: '/',
        requiredPermissions: JSON.stringify(['MANAGE_ROLES', 'SEND_MESSAGES', 'VIEW_CHANNELS']),
        tags: JSON.stringify(['boas vindas', 'autorole', 'dar cargo automaticamente', 'cargos', 'regras', 'comunidade']),
        categories: JSON.stringify(['boas-vindas', 'automacao', 'comunidade']),
        commands: JSON.stringify([
          { name: 'autorole', description: 'Define um cargo a ser atribuído automaticamente a novos membros.', usage: '/autorole @cargo' },
          { name: 'welcome-channel', description: 'Define o canal onde as mensagens de boas-vindas serão enviadas.', usage: '/welcome-channel #canal' },
          { name: 'welcome-message', description: 'Customiza o texto de boas-vindas com tags como {user} e {space}.', usage: '/welcome-message [texto]' },
          { name: 'rules-panel', description: 'Cria uma mensagem com as regras do servidor.', usage: '/rules-panel' },
        ]),
        installCount: 980,
        ratingAverage: 4.8,
        ratingCount: 95,
      },
      {
        id: 'bot_polls',
        slug: 'nuvio-polls',
        name: 'Nuvio Polls',
        tagline: 'Crie enquetes interativas, votações rápidas e colete opiniões da sua comunidade.',
        description: 'Faça enquetes elegantes e com atualização em tempo real. Suporta votação única ou múltipla, enquetes anônimas, contadores de tempo com encerramento automático e relatórios com porcentagens visuais.',
        avatar: '',
        banner: '',
        developerId: devId,
        botUserId: 'user_bot_polls',
        status: 'published',
        isVerified: 1,
        isOfficial: 1,
        prefix: '/',
        requiredPermissions: JSON.stringify(['SEND_MESSAGES', 'ADD_REACTIONS', 'VIEW_CHANNELS']),
        tags: JSON.stringify(['enquetes', 'votacoes', 'perguntas', 'opiniao', 'pesquisas', 'quiz']),
        categories: JSON.stringify(['enquetes', 'comunidade', 'utilidades']),
        commands: JSON.stringify([
          { name: 'poll', description: 'Inicia uma nova votação interativa no canal.', usage: '/poll "Qual seu tema favorito?" "Opção A" "Opção B"' },
          { name: 'poll-end', description: 'Encerra antecipadamente uma enquete ativa.', usage: '/poll-end [id]' },
          { name: 'survey', description: 'Cria um questionário de múltiplas perguntas.', usage: '/survey [titulo]' },
        ]),
        installCount: 650,
        ratingAverage: 4.7,
        ratingCount: 62,
      },
      {
        id: 'bot_support',
        slug: 'nuvio-support',
        name: 'Nuvio Support & Tickets',
        tagline: 'Gerenciamento profissional de tickets, atendimento ao cliente e suporte privativo.',
        description: 'Ideal para espaços que vendem produtos, realizam suporte ou tiram dúvidas. Cria canais de texto privados automaticamente ao clicar em um botão de suporte, com transcrição de conversas e avaliação de atendimento.',
        avatar: '',
        banner: '',
        developerId: devId,
        botUserId: 'user_bot_support',
        status: 'published',
        isVerified: 1,
        isOfficial: 1,
        prefix: '/',
        requiredPermissions: JSON.stringify(['MANAGE_CHANNELS', 'SEND_MESSAGES', 'VIEW_CHANNELS']),
        tags: JSON.stringify(['tickets', 'suporte', 'atendimento', 'chamados', 'ajuda', 'pedidos']),
        categories: JSON.stringify(['tickets-suporte', 'produtividade', 'utilidades']),
        commands: JSON.stringify([
          { name: 'ticket-panel', description: 'Envia o painel de abertura de tickets no canal.', usage: '/ticket-panel [titulo]' },
          { name: 'close', description: 'Fecha o ticket atual com salvamento de histórico.', usage: '/close [motivo]' },
          { name: 'transcript', description: 'Gera uma transcrição em texto da conversa do ticket.', usage: '/transcript' },
          { name: 'add-user', description: 'Adiciona um membro ao ticket de suporte em andamento.', usage: '/add-user @usuario' },
        ]),
        installCount: 520,
        ratingAverage: 4.9,
        ratingCount: 54,
      },
      {
        id: 'bot_level',
        slug: 'nuvio-level',
        name: 'Nuvio Level & XP',
        tagline: 'Gamificação completa: suba de nível conversando, desbloqueie cargos e dispute o topo do ranking.',
        description: 'Transforme a participação no seu espaço em uma competição divertida! Membros ganham pontos de experiência por conversar nos canais de texto e voz. Oferece cartões de perfil, placar de líderes e cargos por nível atingido.',
        avatar: '',
        banner: '',
        developerId: devId,
        botUserId: 'user_bot_level',
        status: 'published',
        isVerified: 1,
        isOfficial: 1,
        prefix: '/',
        requiredPermissions: JSON.stringify(['MANAGE_ROLES', 'SEND_MESSAGES', 'VIEW_CHANNELS']),
        tags: JSON.stringify(['niveis', 'xp', 'rank', 'gamificacao', 'placar', 'pontos', 'recompensas']),
        categories: JSON.stringify(['niveis-xp', 'comunidade', 'jogos']),
        commands: JSON.stringify([
          { name: 'rank', description: 'Mostra seu nível atual, progresso de XP e posição.', usage: '/rank [@usuario]' },
          { name: 'leaderboard', description: 'Exibe o ranking dos membros mais ativos do espaço.', usage: '/leaderboard' },
          { name: 'level-role', description: 'Configura um cargo que será dado automaticamente ao atingir certo nível.', usage: '/level-role [nivel] @cargo' },
        ]),
        installCount: 890,
        ratingAverage: 4.8,
        ratingCount: 88,
      },
    ];

    const insertBot = db.prepare(`
      INSERT INTO bots (
        id, slug, name, tagline, description, avatar, banner, developer_id, bot_user_id,
        status, is_verified, is_official, prefix, required_permissions, tags, categories,
        commands, install_count, rating_average, rating_count, version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1.0.0', ?, ?
      )
    `);

    for (const b of starterBots) {
      insertBot.run(
        b.id, b.slug, b.name, b.tagline, b.description, b.avatar, b.banner, b.developerId,
        b.botUserId, b.status, b.isVerified, b.isOfficial, b.prefix, b.requiredPermissions,
        b.tags, b.categories, b.commands, b.installCount, b.ratingAverage, b.ratingCount,
        now, now
      );
    }
    console.log('[defaults] Seeded default official starter bots');
  }

  // 13. Soundpad tables and 16 official preset sounds
  db.exec(`
    CREATE TABLE IF NOT EXISTS soundpad_sounds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'Geral',
      audio_url TEXT NOT NULL,
      storage_key TEXT,
      builtin_sound_id TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      default_volume REAL NOT NULL DEFAULT 1.0,
      emoji TEXT,
      icon_url TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'approved',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_soundpad_scope ON soundpad_sounds(scope);
    CREATE INDEX IF NOT EXISTS idx_soundpad_owner_id ON soundpad_sounds(owner_id);
    CREATE INDEX IF NOT EXISTS idx_soundpad_space_id ON soundpad_sounds(space_id);
    CREATE INDEX IF NOT EXISTS idx_soundpad_category ON soundpad_sounds(category);

    CREATE TABLE IF NOT EXISTS soundpad_favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sound_id TEXT NOT NULL REFERENCES soundpad_sounds(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, sound_id)
    );
    CREATE INDEX IF NOT EXISTS idx_soundpad_fav_user ON soundpad_favorites(user_id);

    CREATE TABLE IF NOT EXISTS soundpad_usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sound_id TEXT NOT NULL REFERENCES soundpad_sounds(id) ON DELETE CASCADE,
      play_count INTEGER NOT NULL DEFAULT 1,
      last_played_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, sound_id)
    );
    CREATE INDEX IF NOT EXISTS idx_soundpad_usage_user ON soundpad_usage(user_id);
  `);

  const officialCount = (db.prepare("SELECT count(*) as count FROM soundpad_sounds WHERE scope = 'official'").get() as { count: number }).count;
  if (officialCount === 0) {
    const officialPresets = [
      { id: 'official-airhorn', name: 'Airhorn', category: 'Clássicos', emoji: '📢', url: '/sounds/soundpad/airhorn.wav', duration: 1300, vol: 0.85, tags: ['airhorn', 'buzina', 'hype', 'loud'] },
      { id: 'official-crickets', name: 'Crickets', category: 'Clássicos', emoji: '🦗', url: '/sounds/soundpad/crickets.wav', duration: 1800, vol: 0.85, tags: ['crickets', 'grilos', 'silence', 'awkward'] },
      { id: 'official-sad-violin', name: 'Sad Violin', category: 'Clássicos', emoji: '🎻', url: '/sounds/soundpad/sad_violin.wav', duration: 2400, vol: 0.85, tags: ['violin', 'triste', 'sad', 'drama'] },
      { id: 'official-womp-womp', name: 'Womp Womp', category: 'Clássicos', emoji: '🎺', url: '/sounds/soundpad/womp_womp.wav', duration: 1400, vol: 0.85, tags: ['womp', 'fail', 'trompete', 'derrota'] },
      { id: 'official-rimshot', name: 'Rimshot', category: 'Clássicos', emoji: '🥁', url: '/sounds/soundpad/rimshot.wav', duration: 600, vol: 0.85, tags: ['rimshot', 'ba dum tss', 'piada', 'bateria'] },
      { id: 'official-sad-trombone', name: 'Sad Trombone', category: 'Clássicos', emoji: '📯', url: '/sounds/soundpad/sad_trombone.wav', duration: 2200, vol: 0.85, tags: ['trombone', 'fail', 'wah wah'] },
      { id: 'official-dun-dun-dun', name: 'DUN DUN DUN', category: 'Clássicos', emoji: '⚡', url: '/sounds/soundpad/dun_dun_dun.wav', duration: 2000, vol: 0.85, tags: ['dun', 'dramatico', 'suspense', 'choque'] },
      { id: 'official-vine-boom', name: 'Vine Boom', category: 'Clássicos', emoji: '💥', url: '/sounds/soundpad/vine_boom.wav', duration: 1500, vol: 0.85, tags: ['boom', 'bass', 'meme', 'impacto'] },
      { id: 'official-bruh', name: 'Bruh', category: 'Diversão', emoji: '🗿', url: '/sounds/soundpad/bruh.wav', duration: 700, vol: 0.85, tags: ['bruh', 'meme', 'facepalm', 'moai'] },
      { id: 'official-oh-no', name: 'Oh No', category: 'Diversão', emoji: '😱', url: '/sounds/soundpad/oh_no.wav', duration: 900, vol: 0.85, tags: ['oh no', 'desastre', 'meme', 'panico'] },
      { id: 'official-sheesh', name: 'Sheesh', category: 'Diversão', emoji: '🥶', url: '/sounds/soundpad/sheesh.wav', duration: 1000, vol: 0.85, tags: ['sheesh', 'hiss', 'apito', 'gelo'] },
      { id: 'official-bonk', name: 'Bonk', category: 'Diversão', emoji: '🔨', url: '/sounds/soundpad/bonk.wav', duration: 500, vol: 0.85, tags: ['bonk', 'martelo', 'pancada', 'meme'] },
      { id: 'official-noice', name: 'Noice', category: 'Diversão', emoji: '👌', url: '/sounds/soundpad/noice.wav', duration: 700, vol: 0.85, tags: ['noice', 'nice', 'estalo', 'perfeito'] },
      { id: 'official-sus', name: 'Sus', category: 'Diversão', emoji: '👁️', url: '/sounds/soundpad/sus.wav', duration: 1300, vol: 0.85, tags: ['sus', 'among us', 'impostor', 'estranho'] },
      { id: 'official-wilhelm', name: 'Wilhelm', category: 'Diversão', emoji: '🗣️', url: '/sounds/soundpad/wilhelm.wav', duration: 1200, vol: 0.85, tags: ['wilhelm', 'grito', 'scream', 'filme'] },
      { id: 'official-toot', name: 'Toot', category: 'Diversão', emoji: '🎉', url: '/sounds/soundpad/toot.wav', duration: 650, vol: 0.85, tags: ['toot', 'festa', 'buzina', 'alegria'] },
    ];

    const insertSound = db.prepare(`
      INSERT INTO soundpad_sounds (
        id, name, scope, owner_id, space_id, category, audio_url,
        builtin_sound_id, duration_ms, default_volume, emoji, tags, status, created_at, updated_at
      ) VALUES (
        ?, ?, 'official', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?
      )
    `);

    for (const s of officialPresets) {
      insertSound.run(
        s.id, s.name, s.category, s.url, s.id.replace('official-', ''),
        s.duration, s.vol, s.emoji, JSON.stringify(s.tags), now, now
      );
    }
    console.log('[defaults] Seeded 16 official soundpad preset sounds');
  }

  // 17. Ensure @everyone role in all spaces has USE_SOUNDPAD permission
  migrateSoundpadEveryonePermissions(db);

  // 18. Winks table and official preset seeding
  db.exec(`
    CREATE TABLE IF NOT EXISTS winks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'diversao',
      description TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '✨',
      original_filename TEXT,
      original_mime TEXT,
      original_size INTEGER DEFAULT 0,
      video_path TEXT,
      webm_path TEXT,
      webm_url TEXT,
      mp4_path TEXT,
      mp4_url TEXT,
      thumbnail_path TEXT,
      thumbnail_url TEXT,
      has_alpha INTEGER NOT NULL DEFAULT 0,
      has_audio INTEGER NOT NULL DEFAULT 0,
      audio_codec TEXT,
      video_codec TEXT,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      fps INTEGER DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 4000,
      default_volume REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      published INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      published_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_winks_category ON winks(category);
    CREATE INDEX IF NOT EXISTS idx_winks_status ON winks(status);
    CREATE INDEX IF NOT EXISTS idx_winks_published ON winks(published);
  `);

  // Purge any legacy/removed winks from the database so only current catalog exists
  db.prepare("DELETE FROM winks WHERE id NOT IN ('diabravinho', 'bolsogado', 'nikole')").run();

  const insertWink = db.prepare(`
    INSERT INTO winks (
      id, name, category, description, emoji,
      webm_url, mp4_url, thumbnail_url,
      has_alpha, has_audio, width, height, fps,
      duration_ms, default_volume, status, published,
      created_at, updated_at, published_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, 1.0, 'completed', 1,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      category=excluded.category,
      description=excluded.description,
      emoji=excluded.emoji,
      webm_url=excluded.webm_url,
      mp4_url=excluded.mp4_url,
      thumbnail_url=excluded.thumbnail_url,
      has_alpha=excluded.has_alpha,
      has_audio=excluded.has_audio,
      width=excluded.width,
      height=excluded.height,
      fps=excluded.fps,
      duration_ms=excluded.duration_ms,
      status='completed',
      published=1,
      updated_at=excluded.updated_at
  `);
  const winkNow = Date.now();
  for (const w of OFFICIAL_WINKS) {
    insertWink.run(
      w.id,
      w.name,
      w.category,
      w.description,
      w.previewEmoji,
      w.webmUrl ?? null,
      w.mp4Url ?? null,
      w.thumbnailUrl ?? null,
      w.hasAlpha ? 1 : 0,
      w.hasAudio ? 1 : 0,
      w.width ?? 1920,
      w.height ?? 1080,
      w.fps ?? 24,
      w.durationMs,
      winkNow,
      winkNow,
      winkNow
    );
  }
  console.log('[defaults] Seeded official winks (diabravinho, bolsogado, nikole) into database');

}

/**
 * Ensure the `@everyone` role of every space has the USE_SOUNDPAD permission
 * bit set (1n << 27n = 134217728n). Idempotent — preserves all existing bits
 * and does not touch custom roles or overrides.
 */
export function migrateSoundpadEveryonePermissions(db: Database.Database): number {
  const hasRoles = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='roles'").get();
  if (!hasRoles) return 0;

  const USE_SOUNDPAD_BIT = 1n << 27n;
  const roles = db.prepare(`
    SELECT id, space_id, permissions
    FROM roles
    WHERE id = space_id OR name = '@everyone'
  `).all() as { id: string; space_id: string; permissions: string | null }[];

  const updateStmt = db.prepare('UPDATE roles SET permissions = ? WHERE id = ?');
  let updatedCount = 0;

  for (const role of roles) {
    let perms = 0n;
    try {
      perms = role.permissions ? BigInt(role.permissions) : 0n;
    } catch {
      perms = 0n;
    }

    if ((perms & USE_SOUNDPAD_BIT) === 0n) {
      const newPerms = (perms | USE_SOUNDPAD_BIT).toString();
      updateStmt.run(newPerms, role.id);
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    console.log(`[defaults] Added USE_SOUNDPAD to @everyone role in ${updatedCount} space(s)`);
  }
  return updatedCount;
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
  // 17. Ensure Security Center tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS safety_reports (
      id TEXT PRIMARY KEY,
      protocol TEXT NOT NULL UNIQUE,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      channel_id TEXT,
      space_id TEXT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_admin_id TEXT REFERENCES users(id),
      resolution_notes TEXT,
      resolved_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_safety_reports_reporter ON safety_reports(reporter_id);
    CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON safety_reports(status);
    CREATE INDEX IF NOT EXISTS idx_safety_reports_priority ON safety_reports(priority);
    CREATE INDEX IF NOT EXISTS idx_safety_reports_target ON safety_reports(target_type, target_id);

    CREATE TABLE IF NOT EXISTS safety_report_evidences (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES safety_reports(id) ON DELETE CASCADE,
      message_id TEXT,
      content_snapshot TEXT,
      author_id TEXT,
      author_username TEXT,
      timestamp INTEGER,
      attachments TEXT,
      sha256_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_safety_report_ev_report ON safety_report_evidences(report_id);

    CREATE TABLE IF NOT EXISTS security_cases (
      id TEXT PRIMARY KEY,
      protocol TEXT NOT NULL UNIQUE,
      report_id TEXT REFERENCES safety_reports(id),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'received',
      subject_user_id TEXT REFERENCES users(id),
      subject_username TEXT,
      subject_space_id TEXT,
      assigned_to TEXT REFERENCES users(id),
      summary TEXT,
      resolution TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_security_cases_status ON security_cases(status);
    CREATE INDEX IF NOT EXISTS idx_security_cases_subject_user ON security_cases(subject_user_id);

    CREATE TABLE IF NOT EXISTS evidence_vault (
      id TEXT PRIMARY KEY,
      case_id TEXT REFERENCES security_cases(id),
      report_id TEXT REFERENCES safety_reports(id),
      evidence_type TEXT NOT NULL,
      collected_by TEXT NOT NULL,
      source TEXT NOT NULL,
      hash_sha256 TEXT NOT NULL,
      payload_encrypted TEXT NOT NULL,
      metadata TEXT NOT NULL,
      is_extremely_sensitive INTEGER NOT NULL DEFAULT 0,
      custody_log TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_vault_case ON evidence_vault(case_id);

    CREATE TABLE IF NOT EXISTS authority_requests (
      id TEXT PRIMARY KEY,
      protocol_number TEXT NOT NULL,
      requesting_body TEXT NOT NULL,
      authority_name TEXT NOT NULL,
      authority_contact TEXT NOT NULL,
      request_type TEXT NOT NULL,
      legal_basis TEXT NOT NULL,
      target_user_id TEXT,
      target_space_id TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      preservation_until INTEGER,
      notes TEXT,
      created_admin_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_authority_requests_status ON authority_requests(status);
    CREATE INDEX IF NOT EXISTS idx_authority_requests_protocol ON authority_requests(protocol_number);

    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      subject_user_id TEXT,
      subject_username TEXT,
      subject_space_id TEXT,
      technical_explanation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_subject ON security_alerts(subject_user_id);

    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_username TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      case_id TEXT,
      justification TEXT NOT NULL,
      ip TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_security_audit_admin ON security_audit_logs(admin_id);
    CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at);
  `);


  // 17. Ensure verification columns and tables
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    if (!userCols.some((c) => c.name === 'verification_status')) {
      db.prepare("ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'none'").run();
    }
    if (!userCols.some((c) => c.name === 'verification_category')) {
      db.prepare('ALTER TABLE users ADD COLUMN verification_category TEXT').run();
    }
  } catch (err) {
    console.warn('[defaults] Verification users columns check:', err);
  }

  try {
    const spaceCols = db.prepare('PRAGMA table_info(spaces)').all() as Array<{ name: string }>;
    if (!spaceCols.some((c) => c.name === 'verification_status')) {
      db.prepare("ALTER TABLE spaces ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'none'").run();
    }
    if (!spaceCols.some((c) => c.name === 'verification_category')) {
      db.prepare('ALTER TABLE spaces ADD COLUMN verification_category TEXT').run();
    }
  } catch (err) {
    console.warn('[defaults] Verification spaces columns check:', err);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS entity_verifications (
      id TEXT PRIMARY KEY NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'verified',
      method TEXT NOT NULL DEFAULT 'manual_review',
      public_label TEXT,
      approved_by_admin_id TEXT REFERENCES users(id),
      approved_at INTEGER NOT NULL,
      revoked_by_admin_id TEXT REFERENCES users(id),
      revoked_at INTEGER,
      revoked_reason TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entity_verif_target ON entity_verifications(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_entity_verif_status ON entity_verifications(status);
    CREATE INDEX IF NOT EXISTS idx_entity_verif_category ON entity_verifications(category);

    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY NOT NULL,
      requester_user_id TEXT NOT NULL REFERENCES users(id),
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      public_name TEXT NOT NULL,
      activity_description TEXT,
      official_website TEXT,
      social_links TEXT DEFAULT '[]',
      professional_links TEXT DEFAULT '[]',
      domain_to_verify TEXT,
      domain_token TEXT,
      domain_verified INTEGER NOT NULL DEFAULT 0,
      evidence_notes TEXT,
      rejection_reason TEXT,
      info_request_notes TEXT,
      reviewed_by_admin_id TEXT REFERENCES users(id),
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_verif_req_status ON verification_requests(status);
    CREATE INDEX IF NOT EXISTS idx_verif_req_requester ON verification_requests(requester_user_id);
    CREATE INDEX IF NOT EXISTS idx_verif_req_target ON verification_requests(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_verif_req_created ON verification_requests(created_at);

    CREATE TABLE IF NOT EXISTS verification_audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      admin_id TEXT,
      admin_username TEXT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      request_id TEXT,
      category TEXT NOT NULL,
      justification TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_verif_audit_target ON verification_audit_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_verif_audit_admin ON verification_audit_logs(admin_id);
    CREATE INDEX IF NOT EXISTS idx_verif_audit_created ON verification_audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS streamer_channels (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      channel_url TEXT NOT NULL,
      linked_space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
      is_live INTEGER NOT NULL DEFAULT 0,
      stream_title TEXT,
      stream_game TEXT,
      stream_thumbnail TEXT,
      viewer_count INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER,
      last_checked_at INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_streamer_channels_user ON streamer_channels(user_id);
    CREATE INDEX IF NOT EXISTS idx_streamer_channels_live ON streamer_channels(is_live);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_streamer_channels_platform_channel ON streamer_channels(platform, channel_name);
  `);

  // 18. Ensure space_members custom profile and privacy columns exist
  try {
    const memberCols = db.prepare('PRAGMA table_info(space_members)').all() as Array<{ name: string }>;
    if (memberCols.length > 0) {
      if (!memberCols.some((c) => c.name === 'avatar')) {
        db.prepare('ALTER TABLE space_members ADD COLUMN avatar TEXT').run();
      }
      if (!memberCols.some((c) => c.name === 'allow_dms')) {
        db.prepare('ALTER TABLE space_members ADD COLUMN allow_dms INTEGER NOT NULL DEFAULT 1').run();
      }
      if (!memberCols.some((c) => c.name === 'allow_friend_requests')) {
        db.prepare('ALTER TABLE space_members ADD COLUMN allow_friend_requests INTEGER NOT NULL DEFAULT 1').run();
      }
    }
  } catch (err) {
    console.warn('[defaults] space_members columns check:', err);
  }

  // 19. Ensure attachments waveform column exists
  try {
    const attCols = db.prepare('PRAGMA table_info(attachments)').all() as Array<{ name: string }>;
    if (attCols.length > 0 && !attCols.some((c) => c.name === 'waveform')) {
      db.prepare('ALTER TABLE attachments ADD COLUMN waveform TEXT').run();
      console.log('[defaults] Added waveform column to attachments');
    }
  } catch (err) {
    console.warn('[defaults] attachments waveform column check:', err);
  }

  // 20. Ensure push_subscriptions table and instance_settings VAPID columns exist
  try {
    const instCols = db.prepare('PRAGMA table_info(instance_settings)').all() as Array<{ name: string }>;
    if (instCols.length > 0) {
      if (!instCols.some((c) => c.name === 'vapid_public_key')) {
        db.prepare('ALTER TABLE instance_settings ADD COLUMN vapid_public_key TEXT').run();
      }
      if (!instCols.some((c) => c.name === 'vapid_private_key')) {
        db.prepare('ALTER TABLE instance_settings ADD COLUMN vapid_private_key TEXT').run();
      }
    }
  } catch (err) {
    console.warn('[defaults] instance_settings vapid columns check:', err);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
  `);

  // 21. Ensure wink preferences tables exist (mutes, favorites, recents)
  db.exec(`
    CREATE TABLE IF NOT EXISTS wink_contact_mutes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL,
      mute_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wink_mutes_user_target ON wink_contact_mutes(user_id, target_user_id);
    CREATE INDEX IF NOT EXISTS idx_wink_mutes_user ON wink_contact_mutes(user_id);
    CREATE INDEX IF NOT EXISTS idx_wink_mutes_target ON wink_contact_mutes(target_user_id);

    CREATE TABLE IF NOT EXISTS wink_favorites (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wink_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wink_favorites_user_wink ON wink_favorites(user_id, wink_id);
    CREATE INDEX IF NOT EXISTS idx_wink_favorites_user ON wink_favorites(user_id);

    CREATE TABLE IF NOT EXISTS wink_recents (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wink_id TEXT NOT NULL,
      used_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wink_recents_user_wink ON wink_recents(user_id, wink_id);
    CREATE INDEX IF NOT EXISTS idx_wink_recents_user ON wink_recents(user_id);
    CREATE INDEX IF NOT EXISTS idx_wink_recents_used_at ON wink_recents(used_at);
  `);


  // 22. Ensure opportunities and professional network tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS professional_profiles (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      headline TEXT,
      bio TEXT,
      roles TEXT NOT NULL DEFAULT '["job_seeker"]',
      skills TEXT NOT NULL DEFAULT '[]',
      experiences TEXT NOT NULL DEFAULT '[]',
      education TEXT NOT NULL DEFAULT '[]',
      portfolio TEXT NOT NULL DEFAULT '[]',
      languages TEXT NOT NULL DEFAULT '[]',
      location TEXT,
      work_preference TEXT NOT NULL DEFAULT 'any',
      expected_salary TEXT,
      resume_url TEXT,
      resume_name TEXT,
      is_public INTEGER NOT NULL DEFAULT 1,
      hide_contact_info INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prof_profiles_public ON professional_profiles(is_public);

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      company_name TEXT,
      company_logo TEXT,
      creator_role TEXT DEFAULT 'individual',
      contract_type TEXT,
      responsibilities TEXT,
      qualifications_min TEXT,
      qualifications_pref TEXT,
      education TEXT,
      experience_level TEXT,
      work_schedule TEXT,
      remuneration_type TEXT NOT NULL DEFAULT 'negotiable',
      salary_min INTEGER,
      salary_max INTEGER,
      currency TEXT NOT NULL DEFAULT 'BRL',
      benefits TEXT DEFAULT '[]',
      vacancies_count INTEGER NOT NULL DEFAULT 1,
      deadline INTEGER,
      questions TEXT DEFAULT '[]',
      documents_required TEXT DEFAULT '[]',
      external_link TEXT,
      budget INTEGER,
      budget_type TEXT,
      skills TEXT DEFAULT '[]',
      deliverables TEXT,
      complexity TEXT,
      expected_duration TEXT,
      cover_image TEXT,
      gallery TEXT DEFAULT '[]',
      delivery_days INTEGER,
      revisions_count INTEGER,
      packages TEXT,
      services_included TEXT,
      services_excluded TEXT,
      faqs TEXT DEFAULT '[]',
      requirements TEXT,
      work_modality TEXT NOT NULL DEFAULT 'remote',
      location_country TEXT,
      location_state TEXT,
      location_city TEXT,
      language TEXT NOT NULL DEFAULT 'pt',
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id);
    CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
    CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
    CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
    CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at);

    CREATE TABLE IF NOT EXISTS opportunity_applications (
      id TEXT PRIMARY KEY NOT NULL,
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      message TEXT NOT NULL,
      proposed_price INTEGER,
      proposed_duration TEXT,
      deliverables TEXT,
      package_tier TEXT,
      resume_url TEXT,
      resume_name TEXT,
      portfolio_urls TEXT DEFAULT '[]',
      answers TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      reviewed_at INTEGER,
      unlocked_at INTEGER,
      rejected_at INTEGER,
      withdrawn_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opp_apps_opp ON opportunity_applications(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opp_apps_applicant ON opportunity_applications(applicant_id);
    CREATE INDEX IF NOT EXISTS idx_opp_apps_target ON opportunity_applications(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_opp_apps_status ON opportunity_applications(status);
    CREATE INDEX IF NOT EXISTS idx_opp_apps_created ON opportunity_applications(created_at);

    CREATE TABLE IF NOT EXISTS opportunity_application_messages (
      id TEXT PRIMARY KEY NOT NULL,
      application_id TEXT NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      attachments TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opp_app_msgs_app ON opportunity_application_messages(application_id);
    CREATE INDEX IF NOT EXISTS idx_opp_app_msgs_created ON opportunity_application_messages(created_at);

    CREATE TABLE IF NOT EXISTS opportunity_negotiations (
      id TEXT PRIMARY KEY NOT NULL,
      application_id TEXT NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      price INTEGER,
      deadline TEXT,
      scope TEXT,
      deliverables TEXT,
      revisions INTEGER,
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      parent_negotiation_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opp_negotiations_app ON opportunity_negotiations(application_id);
    CREATE INDEX IF NOT EXISTS idx_opp_negotiations_created ON opportunity_negotiations(created_at);

    CREATE TABLE IF NOT EXISTS opportunity_favorites (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_favs_user_opp ON opportunity_favorites(user_id, opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opp_favs_user ON opportunity_favorites(user_id);

    CREATE TABLE IF NOT EXISTS opportunity_reports (
      id TEXT PRIMARY KEY NOT NULL,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opp_reports_status ON opportunity_reports(status);
    CREATE INDEX IF NOT EXISTS idx_opp_reports_reporter ON opportunity_reports(reporter_id);
  `);

}
