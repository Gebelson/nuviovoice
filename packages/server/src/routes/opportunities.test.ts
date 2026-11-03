import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema.js';
import { setWorkerId } from '../utils/snowflake.js';
import { ensureDefaults } from '../db/migrate.js';
import { opportunitiesRoutes } from './opportunities.js';

setWorkerId(1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let sqlite: Database.Database;
let testDb: TestDb;
let currentCallerId = 'employer-1';

vi.mock('../db/index.js', () => ({
  getDb: () => testDb,
  getRawDb: () => sqlite,
  schema,
}));

vi.mock('../utils/auth.js', () => ({
  authenticate: async (request: any) => {
    request.userId = currentCallerId;
    request.username = `user_${currentCallerId}`;
  },
  requireAdmin: async () => {},
  verifyJwt: () => ({ userId: currentCallerId, isGuest: false }),
}));

vi.mock('../ws/handler.js', () => ({
  connectionManager: {
    sendToUser: vi.fn(),
  },
}));

function applyMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, '../../drizzle');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    for (const stmt of sqlText.split(/-->\s*statement-breakpoint/)) {
      const clean = stmt.trim();
      if (clean) {
        try {
          db.exec(clean);
        } catch {
          // Ignore
        }
      }
    }
  }
}

describe('Nuvio Oportunidades Backend', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    applyMigrations(sqlite);
    ensureDefaults(sqlite);
    testDb = drizzle(sqlite, { schema });

    // Seed test users using Drizzle
    const now = Date.now();
    testDb.insert(schema.users).values([
      { id: 'employer-1', username: 'recruiter_ana', displayName: 'Ana Recruiter', passwordHash: 'hash', createdAt: now },
      { id: 'candidate-1', username: 'dev_carlos', displayName: 'Carlos Dev', passwordHash: 'hash', createdAt: now },
      { id: 'third-party', username: 'random_user', displayName: 'Random User', passwordHash: 'hash', createdAt: now },
    ]).run();

    app = Fastify();
    await app.register(opportunitiesRoutes);
  });

  afterEach(async () => {
    await app.close();
    sqlite.close();
  });

  it('1. Allows creating a job opportunity and querying with filters', async () => {
    currentCallerId = 'employer-1';

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'job',
        title: 'Desenvolvedor Full-Stack Senior',
        companyName: 'Nuvio Labs',
        category: 'development',
        description: 'Vaga para desenvolvimento da plataforma Nuvio Voice.',
        workModality: 'remote',
        contractType: 'pj',
        remunerationType: 'range',
        salaryMin: 12000,
        salaryMax: 18000,
        skills: ['TypeScript', 'React', 'Fastify', 'WebRTC'],
        benefits: ['Horário flexível', 'Auxílio home-office'],
        questions: [{ id: 'q1', question: 'Quantos anos de experiência com TypeScript?' }],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.payload).opportunity;
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Desenvolvedor Full-Stack Senior');

    // Query catalog
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/opportunities?type=job&category=development&modality=remote',
    });
    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.payload);
    expect(listData.opportunities.length).toBe(1);
    expect(listData.opportunities[0].id).toBe(created.id);
  });

  it('2. Allows creating a Gig with 3-tier packages', async () => {
    currentCallerId = 'candidate-1';

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'gig',
        title: 'Design de Interfaces e Identidade Visual para Apps',
        category: 'design',
        description: 'Criação completa de UI/UX moderna.',
        workModality: 'remote',
        packages: {
          basic: {
            name: 'Básico',
            description: '1 tela wireframe',
            price: 250,
            deliveryDays: 3,
            revisions: 1,
          },
          standard: {
            name: 'Padrão',
            description: '3 telas completas com design system',
            price: 650,
            deliveryDays: 7,
            revisions: 3,
          },
          premium: {
            name: 'Premium',
            description: 'Aplicativo completo com protótipo navegável',
            price: 1500,
            deliveryDays: 14,
            revisions: 5,
          },
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const gig = JSON.parse(createRes.payload).opportunity;
    expect(gig.type).toBe('gig');
    expect(JSON.parse(gig.packages).premium.price).toBe(1500);
  });

  it('3. Manages professional profiles with privacy controls', async () => {
    currentCallerId = 'candidate-1';

    // Update profile
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/opportunities/profile/me',
      payload: {
        headline: 'Engenheiro de Software Especialista em Áudio e RTC',
        bio: 'Desenvolvedor com 8 anos de experiência em WebRTC, React e C++.',
        skills: ['WebRTC', 'React', 'Node.js', 'Go'],
        roles: ['freelancer', 'job_seeker'],
        workPreference: 'remote',
        hideContactInfo: true,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const profile = JSON.parse(updateRes.payload).profile;
    expect(profile.headline).toBe('Engenheiro de Software Especialista em Áudio e RTC');
    expect(profile.skills).toContain('WebRTC');

    // Public retrieval
    currentCallerId = 'employer-1';
    const publicRes = await app.inject({
      method: 'GET',
      url: '/api/opportunities/profile/candidate-1',
    });
    expect(publicRes.statusCode).toBe(200);
    const pubProf = JSON.parse(publicRes.payload).profile;
    expect(pubProf.headline).toBe('Engenheiro de Software Especialista em Áudio e RTC');
    expect(pubProf.resumeUrl).toBeNull(); // Hidden by default
  });

  it('4. Candidate applies to a job, verifying proposal submission', async () => {
    // 1. Employer creates opportunity
    currentCallerId = 'employer-1';
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'job',
        title: 'Backend Node Engineer',
        category: 'development',
        description: 'Vaga backend.',
        workModality: 'remote',
      },
    });
    const oppId = JSON.parse(createRes.payload).opportunity.id;

    // 2. Candidate cannot apply to own opportunity (employer applying to self fails)
    const selfApplyRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/${oppId}/apply`,
      payload: { message: 'Minha candidatura' },
    });
    expect(selfApplyRes.statusCode).toBe(400);

    // 3. Candidate applies
    currentCallerId = 'candidate-1';
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/${oppId}/apply`,
      payload: {
        message: 'Olá! Tenho amplo domínio do ecossistema Node/Fastify e adoraria fazer parte.',
        answers: [{ question: 'Disponibilidade', answer: 'Imediata' }],
      },
    });
    expect(applyRes.statusCode).toBe(201);
    const appData = JSON.parse(applyRes.payload).application;
    expect(appData.status).toBe('submitted');
    expect(appData.targetUserId).toBe('employer-1');
  });

  it('5. CRITICAL TEST: Proposal Chat is locked on backend until accepted, and unlocked upon acceptance', async () => {
    // 1. Create opportunity
    currentCallerId = 'employer-1';
    const oppRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'freelance',
        title: 'Modelagem 3D do Mascote Nuvio',
        category: 'engineering_3d',
        description: 'Projeto para modelar e riggar o mascote.',
        workModality: 'remote',
        budget: 1200,
      },
    });
    const oppId = JSON.parse(oppRes.payload).opportunity.id;

    // 2. Candidate sends proposal
    currentCallerId = 'candidate-1';
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/${oppId}/apply`,
      payload: {
        message: 'Faço o modelo 3D em Blender em 5 dias com animações de idle e pulo.',
        proposedPrice: 1100,
        proposedDuration: '5 dias',
      },
    });
    const appId = JSON.parse(applyRes.payload).application.id;

    // 3. Candidate tries to send message in proposal chat BEFORE recipient accepts:
    // MUST BE REFUSED WITH 403 chat_locked_pending_approval
    const attemptMessageBefore = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/messages`,
      payload: { content: 'Ei, você viu minha proposta?' },
    });
    expect(attemptMessageBefore.statusCode).toBe(403);
    const errBody = JSON.parse(attemptMessageBefore.payload);
    expect(errBody.error).toBe('chat_locked_pending_approval');

    // 4. Employer views the application: status transitions to 'viewed'
    currentCallerId = 'employer-1';
    const viewRes = await app.inject({
      method: 'GET',
      url: `/api/opportunities/applications/${appId}`,
    });
    expect(viewRes.statusCode).toBe(200);
    const viewedApp = JSON.parse(viewRes.payload).application;
    expect(viewedApp.status).toBe('viewed');

    // Even while 'viewed', candidate still CANNOT send messages until explicit acceptance!
    currentCallerId = 'candidate-1';
    const attemptMessageWhileViewed = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/messages`,
      payload: { content: 'Aguardando retorno!' },
    });
    expect(attemptMessageWhileViewed.statusCode).toBe(403);
    expect(JSON.parse(attemptMessageWhileViewed.payload).error).toBe('chat_locked_pending_approval');

    // 5. Employer accepts the proposal
    currentCallerId = 'employer-1';
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/accept`,
    });
    expect(acceptRes.statusCode).toBe(200);
    expect(JSON.parse(acceptRes.payload).application.status).toBe('chat_unlocked');

    // 6. Now candidate CAN send messages in unlocked chat!
    currentCallerId = 'candidate-1';
    const successMsgCandidate = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/messages`,
      payload: { content: 'Obrigado por aceitar! Vou começar a primeira versão.' },
    });
    expect(successMsgCandidate.statusCode).toBe(201);
    const msgData = JSON.parse(successMsgCandidate.payload).message;
    expect(msgData.content).toBe('Obrigado por aceitar! Vou começar a primeira versão.');

    // 7. Employer can also reply in unlocked chat
    currentCallerId = 'employer-1';
    const successMsgEmployer = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/messages`,
      payload: { content: 'Excelente! Pode me mandar as prévias por aqui.' },
    });
    expect(successMsgEmployer.statusCode).toBe(201);

    // 8. Third-party cannot view or send messages in this proposal
    currentCallerId = 'third-party';
    const thirdPartyGet = await app.inject({
      method: 'GET',
      url: `/api/opportunities/applications/${appId}/messages`,
    });
    expect(thirdPartyGet.statusCode).toBe(403);

    const thirdPartyPost = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/messages`,
      payload: { content: 'Invasão não autorizada' },
    });
    expect(thirdPartyPost.statusCode).toBe(403);
  });

  it('6. Rejection flow keeps chat locked', async () => {
    currentCallerId = 'employer-1';
    const oppRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'job',
        title: 'Estágio em QA',
        category: 'development',
        description: 'Vaga de estágio.',
        workModality: 'remote',
      },
    });
    const oppId = JSON.parse(oppRes.payload).opportunity.id;

    currentCallerId = 'candidate-1';
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/${oppId}/apply`,
      payload: { message: 'Candidatura para estágio' },
    });
    const appId = JSON.parse(applyRes.payload).application.id;

    // Employer rejects
    currentCallerId = 'employer-1';
    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/reject`,
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(JSON.parse(rejectRes.payload).application.status).toBe('rejected');

    // Chat remains locked
    currentCallerId = 'candidate-1';
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/messages`,
      payload: { content: 'Por favor reconsidere' },
    });
    expect(postRes.statusCode).toBe(403);
  });

  it('7. Negotiations: Counter-offer and acceptance flow', async () => {
    // Setup unlocked application
    currentCallerId = 'employer-1';
    const oppRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'freelance',
        title: 'Edição de Vídeo Teaser',
        category: 'video_animation',
        description: 'Teaser de 30s.',
        workModality: 'remote',
        budget: 500,
      },
    });
    const oppId = JSON.parse(oppRes.payload).opportunity.id;

    currentCallerId = 'candidate-1';
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/${oppId}/apply`,
      payload: { message: 'Faço a edição' },
    });
    const appId = JSON.parse(applyRes.payload).application.id;

    currentCallerId = 'employer-1';
    await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/accept`,
    });

    // Candidate proposes negotiation terms
    currentCallerId = 'candidate-1';
    const negRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/applications/${appId}/negotiate`,
      payload: {
        price: 700,
        deadline: '3 dias',
        deliverables: 'Vídeo 4k 60fps com trilha e efeitos sonoros',
        revisions: 2,
      },
    });
    expect(negRes.statusCode).toBe(201);
    const negData = JSON.parse(negRes.payload).negotiation;
    expect(negData.status).toBe('pending');
    expect(negData.version).toBe(1);

    // Employer accepts terms
    currentCallerId = 'employer-1';
    const acceptTermsRes = await app.inject({
      method: 'POST',
      url: `/api/opportunities/negotiations/${negData.id}/accept`,
    });
    expect(acceptTermsRes.statusCode).toBe(200);
    expect(JSON.parse(acceptTermsRes.payload).negotiation.status).toBe('accepted');
  });

  it('8. Reporting an opportunity saves report for administration', async () => {
    currentCallerId = 'employer-1';
    const oppRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: {
        type: 'job',
        title: 'Trabalho falso',
        category: 'other',
        description: 'Vaga suspeita solicitando dados bancários.',
        workModality: 'remote',
      },
    });
    const oppId = JSON.parse(oppRes.payload).opportunity.id;

    currentCallerId = 'candidate-1';
    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/opportunities/report',
      payload: {
        targetType: 'opportunity',
        targetId: oppId,
        reason: 'fraude_ou_golpe',
        details: 'Solicita depósito antecipado para entrevista.',
      },
    });
    expect(reportRes.statusCode).toBe(201);
    expect(JSON.parse(reportRes.payload).success).toBe(true);
  });
});
