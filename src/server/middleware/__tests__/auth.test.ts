import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config BEFORE any imports (prevents env var validation)
// ---------------------------------------------------------------------------
vi.mock('../../config', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars-long',
    COOKIE_SECRET: 'test-cookie-secret-that-is-at-least-32-chars-long',
    NODE_ENV: 'development',
    CORS_ORIGIN: 'http://localhost:5173',
    AI_ENABLED: false,
    ANTHROPIC_API_KEY: '',
    AI_MODEL: 'claude-sonnet-4-5-20250929',
    AI_TEMPERATURE: 0.3,
    AI_MAX_TOKENS: 4096,
  },
}));

// ---------------------------------------------------------------------------
// Mock database — always unhealthy so we exercise in-memory path
// ---------------------------------------------------------------------------
vi.mock('../../database/connection', () => ({
  databaseService: {
    isHealthy: () => false,
    query: vi.fn(),
    getPool: vi.fn(),
    transaction: vi.fn(),
    setConnected: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock UserService for route-level tests
// ---------------------------------------------------------------------------
let mockUserByUsername: any = null;
let mockUserById: any = null;
let mockCreatedUser: any = null;

vi.mock('../../services/UserService', () => ({
  UserService: class {
    async findByUsername(_username: string) {
      return mockUserByUsername;
    }
    async findById(_id: string) {
      return mockUserById;
    }
    async create(data: any) {
      return mockCreatedUser;
    }
  },
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { authMiddleware } from '../auth';
import { authRoutes } from '../../routes/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
const JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars-long';
const WRONG_SECRET = 'completely-wrong-secret-that-is-32-chars-long!!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Fastify request with the given cookies. */
function mockRequest(cookies: Record<string, string> = {}) {
  return { cookies } as any;
}

/** Create a mock Fastify reply with chainable status/code/send. */
function mockReply() {
  const reply: any = {
    statusCode: 200,
    sent: false,
    body: undefined as any,
    code: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(function (this: any, payload: any) {
      this.body = payload;
      this.sent = true;
      return this;
    }),
  };
  return reply;
}

/** Generate a valid access token for the given payload. */
function makeAccessToken(
  payload: { userId: string; username: string; role: string },
  options?: jwt.SignOptions,
) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m', ...options });
}

/** Generate a valid refresh token. */
function makeRefreshToken(
  payload: { userId: string; type: string },
  options?: jwt.SignOptions,
) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d', ...options });
}

// ===========================================================================
// SECTION 1 — authMiddleware unit tests
// ===========================================================================
describe('authMiddleware', () => {
  it('should attach user to request when token is valid', async () => {
    const token = makeAccessToken({ userId: '42', username: 'alice', role: 'admin' });
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(rep.send).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('42');
    expect(req.user.username).toBe('alice');
    expect(req.user.role).toBe('admin');
  });

  it('should return 401 when access_token cookie is missing', async () => {
    const req = mockRequest({});
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(rep.status).toHaveBeenCalledWith(401);
    expect(rep.send).toHaveBeenCalled();
    expect(rep.body.error).toBe('No access token');
  });

  it('should return 401 when token is expired', async () => {
    const token = jwt.sign(
      { userId: '1', username: 'bob', role: 'member' },
      JWT_SECRET,
      { expiresIn: '-10s' },
    );
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(rep.status).toHaveBeenCalledWith(401);
    expect(rep.body.error).toBe('Invalid token');
  });

  it('should return 401 when token is malformed/garbage', async () => {
    const req = mockRequest({ access_token: 'not.a.jwt.at.all' });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(rep.status).toHaveBeenCalledWith(401);
    expect(rep.body.error).toBe('Invalid token');
  });

  it('should return 401 when token is signed with wrong secret', async () => {
    const token = jwt.sign(
      { userId: '1', username: 'eve', role: 'member' },
      WRONG_SECRET,
      { expiresIn: '15m' },
    );
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(rep.status).toHaveBeenCalledWith(401);
    expect(rep.body.error).toBe('Invalid token');
  });

  it('should return 401 when cookie value is empty string', async () => {
    const req = mockRequest({ access_token: '' });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(rep.status).toHaveBeenCalledWith(401);
    expect(rep.body.error).toBe('No access token');
  });

  it('should correctly decode admin role from token', async () => {
    const token = makeAccessToken({ userId: '1', username: 'admin-user', role: 'admin' });
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(req.user.role).toBe('admin');
  });

  it('should correctly decode executive role from token', async () => {
    const token = makeAccessToken({ userId: '2', username: 'exec-user', role: 'executive' });
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(req.user.role).toBe('executive');
  });

  it('should correctly decode manager role from token', async () => {
    const token = makeAccessToken({ userId: '3', username: 'mgr-user', role: 'manager' });
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(req.user.role).toBe('manager');
  });

  it('should correctly decode member role from token', async () => {
    const token = makeAccessToken({ userId: '4', username: 'member-user', role: 'member' });
    const req = mockRequest({ access_token: token });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(req.user.role).toBe('member');
  });

  it('should not set user on request when token verification fails', async () => {
    const req = mockRequest({ access_token: 'bad-token' });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(req.user).toBeUndefined();
  });

  it('should preserve other cookies while reading access_token', async () => {
    const token = makeAccessToken({ userId: '5', username: 'charlie', role: 'member' });
    const req = mockRequest({ access_token: token, other_cookie: 'value123' });
    const rep = mockReply();

    await authMiddleware(req, rep);

    expect(req.user).toBeDefined();
    expect(req.cookies.other_cookie).toBe('value123');
  });
});

// ===========================================================================
// SECTION 2 — Auth route integration tests using Fastify inject
// ===========================================================================
describe('Auth routes', () => {
  let app: FastifyInstance;
  let testPasswordHash: string;

  // Pre-compute a bcrypt hash once for all route tests
  beforeAll(async () => {
    testPasswordHash = await bcrypt.hash('password123', 12);
  });

  beforeEach(async () => {
    // Reset mock user state
    mockUserByUsername = null;
    mockUserById = null;
    mockCreatedUser = null;

    // Build a fresh Fastify instance per test
    app = Fastify({ logger: false });
    await app.register(fastifyCookie, { secret: 'test-cookie-secret-that-is-at-least-32-chars-long' });
    await app.register(authRoutes);
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // -------------------------------------------------------------------------
  // POST /login
  // -------------------------------------------------------------------------
  describe('POST /login', () => {
    it('should return 200 and set cookies on valid credentials', async () => {
      mockUserByUsername = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testPasswordHash,
        fullName: 'Test User',
        role: 'member',
        isActive: true,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'testuser', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.message).toBe('Login successful');
      expect(body.user.username).toBe('testuser');
      expect(body.user.role).toBe('member');
      expect(body.user.id).toBe('1');

      // Verify that cookies are set in the response
      const cookies = res.cookies;
      const accessCookie = cookies.find((c: any) => c.name === 'access_token');
      const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token');
      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();
    });

    it('should return 401 when username is not found', async () => {
      mockUserByUsername = null;

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'nonexistent', password: 'password123' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid credentials');
    });

    it('should return 401 when password is wrong', async () => {
      mockUserByUsername = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testPasswordHash,
        fullName: 'Test User',
        role: 'member',
        isActive: true,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'testuser', password: 'wrongpassword' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid credentials');
    });

    it('should return 500 when username is too short (validation fails)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'ab', password: 'password123' },
      });

      // Zod validation failure is caught by the try/catch and returns 500
      expect(res.statusCode).toBe(500);
    });

    it('should return 500 when password is too short (validation fails)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'validuser', password: '12345' },
      });

      expect(res.statusCode).toBe(500);
    });

    it('should return 500 when request body is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {},
      });

      expect(res.statusCode).toBe(500);
    });

    it('should return user data without passwordHash in response', async () => {
      mockUserByUsername = {
        id: '10',
        username: 'secureuser',
        email: 'secure@example.com',
        passwordHash: testPasswordHash,
        fullName: 'Secure User',
        role: 'admin',
        isActive: true,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'secureuser', password: 'password123' },
      });

      const body = res.json();
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.user.password).toBeUndefined();
    });

    it('should set httpOnly cookies', async () => {
      mockUserByUsername = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testPasswordHash,
        fullName: 'Test User',
        role: 'member',
        isActive: true,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'testuser', password: 'password123' },
      });

      const cookies = res.cookies;
      const accessCookie = cookies.find((c: any) => c.name === 'access_token');
      expect(accessCookie).toBeDefined();
      expect((accessCookie as any).httpOnly).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // POST /register
  // -------------------------------------------------------------------------
  describe('POST /register', () => {
    it('should return 201 on successful registration', async () => {
      mockUserByUsername = null; // No existing user
      mockCreatedUser = {
        id: 'new-id-123',
        username: 'newuser',
        email: 'new@example.com',
        fullName: 'New User',
        role: 'member',
        isActive: true,
      };

      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          username: 'newuser',
          email: 'new@example.com',
          password: 'securepass123',
          fullName: 'New User',
        },
      });

      expect(res.statusCode).toBe(201);

      const body = res.json();
      expect(body.message).toBe('User created successfully');
      expect(body.user.username).toBe('newuser');
      expect(body.user.email).toBe('new@example.com');
      expect(body.user.role).toBe('member');
    });

    it('should return 409 when username already exists', async () => {
      mockUserByUsername = {
        id: '1',
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: testPasswordHash,
        fullName: 'Existing User',
        role: 'member',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          username: 'existinguser',
          email: 'another@example.com',
          password: 'securepass123',
          fullName: 'Another User',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('User already exists');
    });

    it('should return 500 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: { username: 'newuser' },
      });

      // Zod validation failure is caught and returns 500
      expect(res.statusCode).toBe(500);
    });

    it('should return 500 when email is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          username: 'newuser',
          email: 'not-an-email',
          password: 'securepass123',
          fullName: 'New User',
        },
      });

      expect(res.statusCode).toBe(500);
    });

    it('should return 500 when password is too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          username: 'newuser',
          email: 'new@example.com',
          password: '12345',
          fullName: 'New User',
        },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // POST /logout
  // -------------------------------------------------------------------------
  describe('POST /logout', () => {
    it('should return 200 and clear cookies', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Logout successful');

      // Verify cookies are cleared (set with empty value / expired)
      const cookies = res.cookies;
      const accessCookie = cookies.find((c: any) => c.name === 'access_token');
      const refreshCookie = cookies.find((c: any) => c.name === 'refresh_token');
      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();
      // Cleared cookies have empty string value
      expect((accessCookie as any).value).toBe('');
      expect((refreshCookie as any).value).toBe('');
    });

    it('should succeed even without existing cookies', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Logout successful');
    });
  });

  // -------------------------------------------------------------------------
  // POST /refresh
  // -------------------------------------------------------------------------
  describe('POST /refresh', () => {
    it('should return 200 and set a new access_token when refresh token is valid', async () => {
      mockUserById = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'member',
        isActive: true,
      };

      const refreshToken = makeRefreshToken({ userId: '1', type: 'refresh' });

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: `refresh_token=${refreshToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Token refreshed successfully');

      const cookies = res.cookies;
      const accessCookie = cookies.find((c: any) => c.name === 'access_token');
      expect(accessCookie).toBeDefined();
      expect((accessCookie as any).value).toBeTruthy();
    });

    it('should return 401 when refresh_token cookie is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('No refresh token');
    });

    it('should return 401 when token type is not refresh', async () => {
      // Sign a token without type: 'refresh'
      const badToken = jwt.sign(
        { userId: '1', type: 'access' },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' },
      );

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: `refresh_token=${badToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid token type');
    });

    it('should return 401 when refresh token is expired', async () => {
      const expiredToken = jwt.sign(
        { userId: '1', type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: '-10s' },
      );

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: `refresh_token=${expiredToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid refresh token');
    });

    it('should return 401 when user is not found for the token userId', async () => {
      mockUserById = null; // User does not exist

      const refreshToken = makeRefreshToken({ userId: 'deleted-user-99', type: 'refresh' });

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: `refresh_token=${refreshToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('User not found');
    });

    it('should return 401 when refresh token is signed with wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: '1', type: 'refresh' },
        WRONG_SECRET,
        { expiresIn: '7d' },
      );

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: `refresh_token=${badToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid refresh token');
    });

    it('should return 401 when refresh token is garbage', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: 'refresh_token=not-a-valid-jwt',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid refresh token');
    });

    it('should issue a new access token that is verifiable with JWT_SECRET', async () => {
      mockUserById = {
        id: '7',
        username: 'refreshed-user',
        email: 'refresh@example.com',
        fullName: 'Refreshed User',
        role: 'manager',
        isActive: true,
      };

      const refreshToken = makeRefreshToken({ userId: '7', type: 'refresh' });

      const res = await app.inject({
        method: 'POST',
        url: '/refresh',
        headers: {
          cookie: `refresh_token=${refreshToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      const cookies = res.cookies;
      const accessCookie = cookies.find((c: any) => c.name === 'access_token');
      expect(accessCookie).toBeDefined();

      // Decode the newly issued access token and verify its contents
      const decoded = jwt.verify((accessCookie as any).value, JWT_SECRET) as any;
      expect(decoded.userId).toBe('7');
      expect(decoded.username).toBe('refreshed-user');
      expect(decoded.role).toBe('manager');
    });
  });
});
