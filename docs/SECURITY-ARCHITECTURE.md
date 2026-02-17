# Security Architecture

## Overview

This document describes the security architecture of PM Assistant after 10 rounds of production hardening. All layers enforce defense-in-depth: authentication, authorization, input validation, rate limiting, CSRF protection, and data isolation.

---

## Request Lifecycle

```
Client (React SPA)
  |
  |  HTTPS + Cookies (access_token, refresh_token, _csrf)
  v
+---------------------------------------------------------------+
|                    Fastify Server                              |
|                                                                |
|  1. onRequest hooks (in order):                                |
|     - requestLogger          (structured logging)              |
|     - securityMiddleware     (security headers check)          |
|     - CSRF enforcement       (dual cookie check)               |
|                                                                |
|  2. Plugins (registered at startup):                           |
|     - @fastify/helmet        (CSP, HSTS, X-Frame, etc.)       |
|     - @fastify/cors          (origin allowlist, no dev leak)   |
|     - @fastify/cookie        (httpOnly, secure, sameSite)      |
|     - @fastify/csrf-protection (signed CSRF cookies)           |
|     - @fastify/rate-limit    (global 100/min + per-route)      |
|     - Permissions-Policy     (camera, mic, geo, etc. disabled) |
|                                                                |
|  3. preHandler hooks:                                          |
|     - securityValidationMiddleware                             |
|     - authMiddleware         (JWT verify, HS256 only)          |
|                                                                |
|  4. Route Handler:                                             |
|     - Zod schema validation  (all inputs .max() bounded)       |
|     - verifyProjectAccess()  (ownership check)                 |
|     - verifyScheduleAccess() (ownership check)                 |
|     - Business logic                                           |
|                                                                |
|  5. preSerialization hook:                                     |
|     - snake_case -> camelCase normalization                    |
|                                                                |
|  6. onSend hook:                                               |
|     - Permissions-Policy header injection                      |
|                                                                |
|  7. Error handler:                                             |
|     - Query params stripped from error path                    |
|     - Production: generic 500 messages (no stack traces)       |
|     - Audit logging of all errors                              |
+---------------------------------------------------------------+
  |
  v
MySQL Database (via mysql2 connection pool)
```

---

## Authentication

```
+-------------------+     +-------------------+     +-------------------+
|   POST /login     |     |  POST /register   |     |  POST /refresh    |
|   5 req/min       |     |  3 req/min        |     |  10 req/min       |
+-------------------+     +-------------------+     +-------------------+
         |                         |                         |
         v                         v                         v
  Zod validation            Zod validation           Cookie extraction
  (.max on all)             (.max on all)            (refresh_token)
         |                         |                         |
         v                         v                         v
  Case-insensitive          Case-normalize           jwt.verify()
  findByUsername()          username + email          HS256 only
         |                         |                         |
         v                         v                         v
  Timing-safe               Generic 409              Deactivated
  bcrypt.compare()          (no user/email leak)     user check
  (DUMMY_HASH if            Both checks run          (!user.isActive)
   user not found)          regardless                     |
         |                         |                         v
         v                         v                  Token rotation
  Deactivated               bcrypt.hash(12)          (new refresh token
  user check                     |                    on each use)
  (!user.isActive)               v                         |
         |                  Create user                     v
         v                  (lowercase)              Set cookies
  JWT sign (HS256)                                   (httpOnly, secure,
  access: 15min                                       sameSite: lax)
  refresh: 7d
         |
         v
  Set cookies:
  access_token  -> path: /
  refresh_token -> path: /api/v1/auth
```

### Key Properties
- **Timing-safe login**: Always runs `bcrypt.compare` against a dummy hash when user not found
- **Algorithm pinning**: `{ algorithm: 'HS256' }` on sign, `{ algorithms: ['HS256'] }` on verify
- **Token rotation**: New refresh token issued on every `/refresh` call
- **Cookie isolation**: Refresh token restricted to `/api/v1/auth` path
- **Deactivated blocking**: Checked on both login and refresh
- **Enumeration prevention**: Generic 409 on registration, identical error on bad login

---

## Authorization (Ownership Model)

```
Every mutating request:

  authMiddleware
       |
       v
  request.user = { userId, username, role }
       |
       v
  Route handler calls:
  +------------------------------------------+
  | verifyProjectAccess(projectId, userId)   |
  | verifyScheduleAccess(scheduleId, userId) |
  +------------------------------------------+
       |
       v
  Returns project/schedule if user owns it
  Returns null -> 403 Forbidden

Additional checks:
  - Task CRUD: verify task.scheduleId === URL scheduleId (no cross-schedule IDOR)
  - Baseline CRUD: verify baseline.scheduleId === URL scheduleId
  - Comment delete: verify comment.userId === request.user.userId (author only)
  - Workflow CRUD: verify rule.createdBy === userId
  - Resources CRUD: admin/manager role required
  - ProjectMember update/remove: verify member belongs to projectId
```

### Services with User Scoping
| Service | Method | Scoping |
|---------|--------|---------|
| AIActionExecutor | All 11 methods | `verifyProjectAccess` / `verifyScheduleAccess` |
| NLQueryService | All tool functions | User-scoped task fetching |
| AIContextBuilder | `buildProjectContext` | `findById(projectId, userId)` |
| AIContextBuilder | `buildPortfolioContext` | `findByUserId(userId)` |
| LessonsLearnedService | All methods | `userId` filter on lessons array |
| WorkflowService | `evaluateTaskChange` | `r.createdBy === userId` |
| MeetingIntelligenceService | `analyzeTranscript` | Resources scoped to schedule assignments |
| AIChatService | All conversation methods | `conv.userId === userId` |

---

## CSRF Protection

```
GET /api/v1/csrf-token  ->  Set-Cookie: _csrf (signed, httpOnly, strict)
                            Response: { csrfToken: "..." }

POST /api/v1/...  ->  Must include:
                      1. Cookie: access_token=...  (session exists)
                      2. Cookie: _csrf=...         (CSRF cookie exists)
                      3. Header: x-csrf-token=...  (token matches)

Exempt paths (exact match via Set.has()):
  /api/v1/auth/login
  /api/v1/auth/register
  /api/v1/auth/logout
  /api/v1/csrf-token

Pathname matching: request.url.split('?')[0] prevents query-string bypass
```

---

## Input Validation

All request inputs validated with Zod schemas:

| Category | Constraint | Example |
|----------|-----------|---------|
| String fields | `.max(N)` on every field | `name.max(255)`, `description.max(5000)` |
| Array fields | `.max(N)` on every array | `tasks.max(500)`, `tags.max(50)` |
| IDs | `.min(1).max(100)` | `projectId`, `scheduleId`, `taskId` |
| Enums | `z.enum([...])` | `status`, `priority`, `toolName` |
| Dates | `z.string().date()` | `startDate`, `endDate` |
| Numbers | `.min()` / `.max()` | `progressPercentage.min(0).max(100)` |
| URL params | Zod `.parse(request.params)` | All route params validated |
| Query params | `.max(100).optional()` | `projectType`, `feature` |

---

## Rate Limiting

| Endpoint | Limit | Scope |
|----------|-------|-------|
| Global (all routes) | 100 req/min | Per userId or IP |
| `POST /auth/login` | 5 req/min | Per IP |
| `POST /auth/register` | 3 req/min | Per IP |
| `POST /auth/refresh` | 10 req/min | Per IP |

---

## Memory Safety

All in-memory static arrays capped at 10,000 entries (oldest evicted first):

| Service | Array | Cap |
|---------|-------|-----|
| ScheduleService | `comments` | 10,000 |
| ScheduleService | `activities` | 10,000 |
| WorkflowService | `executions` | 10,000 |
| MeetingIntelligenceService | `analyses` | 10,000 |
| AuditService | `events` | 10,000 |
| LessonsLearnedService | `lessons` | 10,000 |
| AIChatService | `conversations` (Map) | 10,000 |

---

## Security Headers

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' (+ unsafe-eval/inline in dev);
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  connect-src 'self' (+ localhost WS in dev);
  object-src 'none'; frame-src 'none';

Strict-Transport-Security: max-age=31536000; includeSubDomains; preload  (production)
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), ...
Cache-Control: no-store, no-cache (on auth routes)
X-Powered-By: (removed)
```

---

## Production vs Development

| Feature | Production | Development |
|---------|-----------|-------------|
| Error messages | Generic "Internal Server Error" | Full error details |
| Swagger/API docs | Disabled | Available at /documentation |
| `/health/metrics` | Returns 404 | Full memory/CPU/process data |
| `/health/ready` | Status only (up/down) | Full latency, memory, AI config |
| CSP | Enforced | Report-only |
| HSTS | Enabled (preload) | Disabled |
| Cookie secure flag | `true` | `false` |
| CORS | Exact origin match only | localhost:* allowed |

---

## WebSocket Security

```
Connection:
  - JWT verified from cookie on upgrade
  - User mapped: Map<WebSocket, { userId, username }>

Broadcasting:
  - broadcastToUser(userId, message)  -- user-scoped only
  - No global broadcast
  - No client count leaked in connection message
```

---

## Commit History

| Round | Commit | Focus |
|-------|--------|-------|
| 5 | `83d40f0` | Initial hardening |
| 6 | `12e3959` | XSS, ownership, user-scoped WebSocket |
| 7 | `d655c6c` | Auth hardening, ownership enforcement, input validation |
| 8 | `31873b7` | IDOR on AI executor, rate limiting, role-based access |
| 9 | `0d0da9d` | AI context IDOR, memory caps, schema bounds |
| 10 | `b83311c` | Task/baseline IDOR, cross-user scoping, auth enumeration |
| 10b | `4bd2627` | Health endpoint hardening, meeting resource scoping |
