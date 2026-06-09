import request from 'supertest';
import express, { Express } from 'express';

// Doit être déclaré avant tout import des routes pour que Jest hisse le mock
jest.mock('uuid', () => ({ v4: () => 'test-session-token' }));

jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      refreshSession:     jest.fn(),
      getUser:            jest.fn(),
      signOut:            jest.fn(),
    },
    from: jest.fn(),
  },
}));

import { supabase } from '../supabase/client';
import authRouter from './auth';

// ── Raccourcis typés ──────────────────────────────────────────────────────────

const mockSignIn  = supabase.auth.signInWithPassword as jest.Mock;
const mockRefresh = supabase.auth.refreshSession    as jest.Mock;
const mockGetUser = supabase.auth.getUser           as jest.Mock;
const mockSignOut = supabase.auth.signOut           as jest.Mock;
const mockFrom    = supabase.from                   as jest.Mock;

// ── Helpers de chaîne Supabase ────────────────────────────────────────────────

/** Simule .select().eq().single() → résout avec `result` */
function qSelect(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

/** Simule .update().eq() → résout avec { error: null } */
function qUpdate(error: unknown = null) {
  return {
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error }),
    }),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROFILE = {
  id: 'user-1', nom: 'Alice', email: 'alice@test.com',
  role: 'User', niveau_accreditation: 1,
  avatar_url: null, last_context: null, actif: true,
};

const SESSION = { access_token: 'jwt-tok', refresh_token: 'rt-tok' };

// ── App minimale de test ──────────────────────────────────────────────────────

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
});

beforeEach(() => {
  jest.resetAllMocks();
  mockSignOut.mockResolvedValue({});
});

// ── POST /login ───────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('body vide → 400 INVALID_INPUT', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('mauvais mot de passe → 401 UNAUTHENTICATED', async () => {
    mockSignIn.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('compte actif=false → 403 FORBIDDEN', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: SESSION },
      error: null,
    });
    mockFrom.mockReturnValueOnce(
      qSelect({ data: { ...PROFILE, actif: false }, error: null })
    );

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'pass' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('succès → 200 avec jwt, refresh_token, session_token, user', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: SESSION },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(qSelect({ data: PROFILE, error: null }))
      .mockReturnValueOnce(qUpdate());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jwt:           'jwt-tok',
      refresh_token: 'rt-tok',
      session_token: 'test-session-token',
      user: expect.objectContaining({ id: 'user-1', nom: 'Alice' }),
    });
  });
});

// ── POST /refresh ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('tokens manquants → 401', async () => {
    // Ni refresh_token ni x-session-token
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('session expirée → 401 SESSION_EXPIRED', async () => {
    mockFrom.mockReturnValueOnce(qSelect({
      data: {
        id: 'user-1',
        session_token:      'tok',
        session_expires_at: new Date(Date.now() - 3_600_000).toISOString(), // 1 h dans le passé
        last_activity_at:   new Date().toISOString(),
        actif: true,
      },
      error: null,
    }));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-session-token', 'tok')
      .send({ refresh_token: 'rt' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('inactivité > 30 min → 401 SESSION_EXPIRED', async () => {
    mockFrom.mockReturnValueOnce(qSelect({
      data: {
        id: 'user-1',
        session_token:      'tok',
        session_expires_at: new Date(Date.now() + 3_600_000).toISOString(), // futur
        last_activity_at:   new Date(Date.now() - 31 * 60_000).toISOString(), // 31 min ago
        actif: true,
      },
      error: null,
    }));

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-session-token', 'tok')
      .send({ refresh_token: 'rt' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('succès → 200 avec nouveaux tokens', async () => {
    mockFrom
      .mockReturnValueOnce(qSelect({
        data: {
          id: 'user-1',
          session_token:      'tok',
          session_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          last_activity_at:   new Date().toISOString(),
          actif: true,
        },
        error: null,
      }))
      .mockReturnValueOnce(qUpdate());

    mockRefresh.mockResolvedValue({
      data: { session: { access_token: 'new-jwt', refresh_token: 'new-rt' } },
      error: null,
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('x-session-token', 'tok')
      .send({ refresh_token: 'rt' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ jwt: 'new-jwt', refresh_token: 'new-rt' });
  });
});

// ── POST /logout ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('sans Authorization → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
