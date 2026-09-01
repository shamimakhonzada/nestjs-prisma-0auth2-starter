# NestJS Prisma 8 Auth Starter

A production-ready NestJS backend with **OAuth 2.0** (Google & GitHub), **credentials auth**, **httpOnly cookie JWT**, **role-based access**, and **Prisma 8** (contract-first ORM).

---

## Tech Stack

| Layer           | Technology                                  |
| --------------- | ------------------------------------------- |
| Framework       | NestJS 12                                   |
| Language        | TypeScript 6                                |
| ORM             | **Prisma 8** (`@prisma/orm-postgres`)       |
| Database        | PostgreSQL 15+                              |
| Auth            | Passport.js · JWT · OAuth 2.0               |
| Validation      | Zod (route bodies) + class-validator (DTOs) |
| Docs            | Swagger / OpenAPI (`/docs`)                 |
| Package manager | pnpm                                        |

---

## Project Structure

```
.
├── prisma.config.ts              # Prisma 8 CLI configuration
├── src/
│   ├── main.ts                   # Bootstrap (helmet, CORS, cookie-parser, Swagger)
│   ├── app.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts    # POST signin/signup, OAuth flows, POST signout
│   │   ├── auth.service.ts       # signIn, signUp, oauthLogin
│   │   ├── dto/
│   │   │   └── create-auth.dto.ts  # SignInDto, SignUpDto
│   │   ├── schema/
│   │   │   └── auth.schema.ts    # Zod: loginSchema, signupSchema
│   │   └── strategies/
│   │       ├── jwt.strategy.ts   # Reads Bearer header OR access_token cookie
│   │       ├── google.strategy.ts
│   │       └── github.strategy.ts
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts    # GET/PATCH/DELETE with ownership enforcement
│   │   ├── user.service.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── change-password.dto.ts
│   │   └── schema/
│   │       └── user.schema.ts    # Zod: createUserSchema, changePasswordSchema, updateUserSchema
│   └── prisma/
│       ├── contract.prisma       # ← Data contract (edit this to change schema)
│       ├── contract.json         # Generated — commit to git
│       ├── contract.d.ts         # Generated — commit to git
│       └── db.ts                 # db client (import { db } from '../prisma/db.js')
```

---

## Prisma 8 — How It Works

Prisma 8 is **contract-first**. There is no `schema.prisma` or generated `@prisma/client`. Instead:

1. **Define your models** in `src/prisma/contract.prisma`
2. **Emit the contract** to regenerate the typed client
3. **Query using `db.orm`** — fully typed and autocompleted

### Data contract (`contract.prisma`)

```prisma
enum Role {
  USER
  ADMIN
}

model User {
  id        String       @id @default(uuid())
  email     String       @unique
  username  String?
  avatar    String?
  password  String?      // null for OAuth-only accounts
  name      String?
  role      Role         @default(USER)
  accounts  OAuthAccount[]
  createdAt TimestamptzString @default(now())
  updatedAt temporal.updatedAtString()
}

model OAuthAccount {
  id           String    @id @default(uuid())
  provider     String    // "GOOGLE" | "GITHUB"
  providerId   String
  accessToken  String?
  refreshToken String?
  expiresAt    DateTime?
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String
  @@unique([provider, providerId])
}
```

### Query style

```ts
import { db } from '../prisma/db.js';

// Find
const user = await db.orm.public.User.where({ email }).first();

// Create
const user = await db.orm.public.User.create({ email, name, password });

// Update
await db.orm.public.User.where({ id }).update({ name });

// Delete
await db.orm.public.User.where({ id }).delete();
```

### Prisma CLI commands

```bash
# After editing contract.prisma — regenerate contract.json + contract.d.ts
pnpm prisma contract emit

# Create / sync tables in the database
pnpm db:update

# Plan a migration
pnpm db:migrate
```

> Both `contract.json` and `contract.d.ts` are **generated files — commit them to git**.

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Google OAuth app credentials (optional)
- GitHub OAuth app credentials (optional)

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Create tables in your database
pnpm db:update

# 4. Start in watch mode
pnpm dev
```

Server: `http://localhost:4000`  
Swagger docs: `http://localhost:4000/docs`

---

## Environment Variables

```env
# ── Database ─────────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nestjs"

# ── Server ───────────────────────────────────────────
PORT=4000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# ── JWT ──────────────────────────────────────────────
# Generate with: openssl rand -base64 32
JWT_SECRET="your-strong-random-secret"
JWT_REFRESH_SECRET="your-other-strong-random-secret"
JWT_EXPIRATION="1d"

# ── Google OAuth ─────────────────────────────────────
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK="http://localhost:4000/api/v1/auth/google/callback"

# ── GitHub OAuth ─────────────────────────────────────
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_CALLBACK="http://localhost:4000/api/v1/auth/github/callback"
```

> **Important:** OAuth callback URLs must point to the **backend** (`localhost:4000/api/v1/...`), not the frontend.

---

## Authentication Flow

### Credentials (email + password)

```
POST /api/v1/auth/signup    →  Creates account, returns { message, data }
POST /api/v1/auth/signin    →  Validates, sets httpOnly cookie, returns { message, user }
POST /api/v1/auth/signout   →  Clears the access_token cookie
```

Passwords are hashed with **argon2**.

### OAuth (Google / GitHub)

```
GET /api/v1/auth/google              →  Redirects to Google consent screen
GET /api/v1/auth/google/callback     →  Sets httpOnly cookie, redirects to FRONTEND_URL/dashboard

GET /api/v1/auth/github              →  Redirects to GitHub consent screen
GET /api/v1/auth/github/callback     →  Sets httpOnly cookie, redirects to FRONTEND_URL/dashboard
```

`AuthService.oauthLogin()` does:

1. Find-or-create `User` by email
2. Upsert `OAuthAccount` (provider + providerId)
3. Sign JWT → set as `httpOnly` cookie

### JWT / Session

The JWT is stored in an **httpOnly cookie** (`access_token`).  
`JwtStrategy` extracts it from:

1. `Authorization: Bearer <token>` header — for API clients, Postman, Swagger
2. `Cookie: access_token=<token>` — for browser-based SPAs (automatic)

On every protected request, the strategy fetches the full user from the database and attaches it to `req.user` (password stripped).

---

## API Endpoints

### Public

| Method | Endpoint                       | Description                    |
| ------ | ------------------------------ | ------------------------------ |
| `POST` | `/api/v1/auth/signup`          | Register with email + password |
| `POST` | `/api/v1/auth/signin`          | Sign in, sets httpOnly cookie  |
| `POST` | `/api/v1/auth/signout`         | Clear auth cookie              |
| `GET`  | `/api/v1/auth/google`          | Start Google OAuth flow        |
| `GET`  | `/api/v1/auth/google/callback` | Google OAuth callback          |
| `GET`  | `/api/v1/auth/github`          | Start GitHub OAuth flow        |
| `GET`  | `/api/v1/auth/github/callback` | GitHub OAuth callback          |

### Protected (JWT required)

| Method   | Endpoint                    | Description                              |
| -------- | --------------------------- | ---------------------------------------- |
| `GET`    | `/api/v1/user/me`           | Get current user profile                 |
| `GET`    | `/api/v1/user`              | List all users                           |
| `GET`    | `/api/v1/user/:id`          | Get user by ID                           |
| `PATCH`  | `/api/v1/user/:id`          | Update user (own profile only, or ADMIN) |
| `PATCH`  | `/api/v1/user/:id/password` | Change password (own account only)       |
| `DELETE` | `/api/v1/user/:id`          | Delete user (own account only, or ADMIN) |

### Test with curl

```bash
# Sign in and save the token from the response body
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"MyP@ss1"}' | jq -r .accessToken)

# Use token to access a protected route
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/user/me
```

---

## OAuth Provider Setup

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: `http://localhost:4000/api/v1/auth/google/callback`
4. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`

### GitHub

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set Authorization callback URL: `http://localhost:4000/api/v1/auth/github/callback`
3. Copy `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env`

---

## Development Scripts

```bash
pnpm dev              # Start with file watching
pnpm build            # Compile TypeScript
pnpm start:prod       # Run compiled output

pnpm test             # Unit tests
pnpm test:e2e         # End-to-end tests
pnpm test:cov         # Coverage report

pnpm prisma contract emit   # Regenerate contract after schema changes
pnpm db:update              # Sync database tables
pnpm db:migrate             # Plan a migration
```

---

## Security

| Feature              | Implementation                                          |
| -------------------- | ------------------------------------------------------- |
| Password hashing     | argon2 (time-cost, memory-cost hardened)                |
| Auth token transport | httpOnly cookie (not accessible from JS)                |
| CORS                 | Restricted to `FRONTEND_URL` with credentials           |
| HTTP headers         | `helmet` on all responses                               |
| Input validation     | Zod schemas + class-validator DTOs                      |
| Role enforcement     | ADMIN / USER checked in service layer                   |
| Ownership checks     | Users can only modify their own data                    |
| User enumeration     | Generic `"Invalid email or password"` on signin failure |

---

## Troubleshooting

### `secretOrPrivateKey must have a value`

`JWT_SECRET` is missing or empty in `.env`. Ensure `ConfigModule.forRoot({ isGlobal: true })` is present in `AppModule` (it is, by default).

### `redirect_uri_mismatch` (OAuth)

The callback URL registered in the provider console must **exactly** match `GOOGLE_CALLBACK` / `GITHUB_CALLBACK` in `.env`, including the `/api/v1` prefix.

### Cookie not sent in development

Ensure the frontend and backend are on the same origin **or** CORS is configured with `credentials: true` and the frontend uses `fetch(..., { credentials: 'include' })` / Axios `withCredentials: true`.

### `Cannot find module './contract.json'`

Run `pnpm prisma contract emit` to generate the compiled contract files.

### PostgreSQL version error

Prisma 8 requires **PostgreSQL 15 or newer**. Run `SELECT version();` to verify.

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong, unique `JWT_SECRET` (32+ bytes, from `openssl rand -base64 32`)
- [ ] PostgreSQL with TLS / `sslmode=verify-full`
- [ ] Secrets via a secret manager (AWS SSM, Vault, GCP Secret Manager)
- [ ] Rate limiting on auth routes
- [ ] Structured logging + monitoring (e.g., Pino, Datadog)
- [ ] HTTPS with valid TLS certificate (required for `secure` cookies)
- [ ] Refresh token flow + revocation strategy
- [ ] Automated tests for auth flows and guarded routes
