# NestJS OAuth2 Backend (Google + GitHub + JWT + Prisma)

Production-ready starter backend built with NestJS, Passport, JWT, and Prisma (PostgreSQL).

This project implements OAuth 2.0 login with:
- Google (`passport-google-oauth20`)
- GitHub (`passport-github2`)

It stores users and OAuth account links in PostgreSQL and signs JWT access tokens for authenticated API access.

## Table of Contents
1. Overview
2. Tech Stack
3. Project Structure
4. Prerequisites
5. Quick Start
6. Environment Variables
7. OAuth 2.0 Provider Setup
8. How Authentication Works
9. API Endpoints
10. Run and Test
11. Troubleshooting
12. Security Notes
13. Production Checklist

## Overview

### What this backend does
- Handles Google and GitHub OAuth login flows
- Creates/updates user records in PostgreSQL
- Stores linked OAuth provider accounts and provider tokens
- Issues JWT access tokens
- Protects `/user/*` routes with `AuthGuard('jwt')`

### Current flow in this codebase
- OAuth callback calls `AuthService.oauthLogin(...)`
- JWT is created with `@nestjs/jwt`
- Google callback sets `access_token` cookie and redirects to frontend dashboard
- GitHub callback redirects to frontend dashboard

Important: `JwtStrategy` currently reads token from `Authorization: Bearer <token>` header, not cookies. If you rely on cookie auth, you need to extend the JWT extractor logic.

## Tech Stack

- Framework: NestJS v11
- Language: TypeScript
- Auth: Passport, JWT
- ORM: Prisma v7
- Database: PostgreSQL (configured for Neon/pg adapter)
- Package manager: pnpm

## Project Structure

```text
src/
  app.module.ts
  main.ts
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    strategies/
      google.strategy.ts
      github.strategy.ts
      jwt.strategy.ts
  user/
    user.module.ts
    user.controller.ts
    user.service.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
prisma/
  schema.prisma
  migrations/
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (local or hosted)
- Google OAuth app credentials
- GitHub OAuth app credentials

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` from template (see section below).

3. Generate Prisma client and run migrations:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate dev --name init
```

4. Start server in watch mode:

```bash
pnpm run dev
```

5. Server starts on `http://localhost:4000` by default.

## Environment Variables

Create a `.env` file in project root:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?sslmode=verify-full"

# JWT
JWT_SECRET="replace_with_strong_random_secret"
JWT_EXPIRATION="1d"
JWT_REFRESH_SECRET="replace_with_another_secret"
JWT_REFRESH_EXPIRATION="7d"

# App
NODE_ENV="development"
PORT=4000
FRONTEND_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK="http://localhost:4000/auth/google/callback"

# GitHub OAuth
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITHUB_CALLBACK="http://localhost:4000/auth/github/callback"
```

### Variable Notes

- `JWT_SECRET` is required. Missing value causes: `secretOrPrivateKey must have a value`.
- `FRONTEND_URL` is used by CORS in `src/main.ts`.
- OAuth callback URLs must exactly match provider console settings.

## OAuth 2.0 Provider Setup

### Google OAuth setup

1. Open Google Cloud Console.
2. Create/select a project.
3. Configure OAuth consent screen.
4. Create OAuth 2.0 Client ID (Web application).
5. Add Authorized redirect URI:
   - `http://localhost:4000/auth/google/callback`
6. Copy client ID/secret to `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### GitHub OAuth setup

1. Open GitHub Developer Settings -> OAuth Apps.
2. Create a new OAuth App.
3. Set Authorization callback URL:
   - `http://localhost:4000/auth/github/callback`
4. Copy client ID/secret to `.env`:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

## How Authentication Works

### 1) User starts OAuth login
- `GET /auth/google`
- `GET /auth/github`

Passport redirects user to provider consent screen.

### 2) Provider redirects back
- `GET /auth/google/callback`
- `GET /auth/github/callback`

Strategy validates profile and returns normalized user data.

### 3) Backend upserts user/account
`AuthService.oauthLogin(...)` does:
- Find/create `User` by email
- Upsert `OAuthAccount` by (`provider`, `providerId`)
- Sign JWT payload `{ sub, email }`

### 4) Client uses JWT for protected routes
`JwtStrategy` expects:
- `Authorization: Bearer <access_token>`

Protected routes are in `UserController` via `@UseGuards(AuthGuard('jwt'))`.

## API Endpoints

### Public

- `GET /` - health-style sample response
- `GET /auth/google` - start Google OAuth
- `GET /auth/google/callback` - Google callback
- `GET /auth/github` - start GitHub OAuth
- `GET /auth/github/callback` - GitHub callback

### Protected (JWT required)

- `GET /user/me`
- `POST /user`
- `GET /user`
- `GET /user/:id`
- `PATCH /user/:id`
- `DELETE /user/:id`

### Test protected endpoint with cURL

```bash
curl -H "Authorization: Bearer YOUR_JWT" http://localhost:4000/user/me
```

## Run and Test

### Development

```bash
pnpm run dev
```

### Build

```bash
pnpm run build
pnpm run start:prod
```

### Tests

```bash
pnpm run test
pnpm run test:e2e
pnpm run test:cov
```

## Troubleshooting

### `secretOrPrivateKey must have a value`

Cause:
- `JWT_SECRET` missing/empty at runtime.

Fix:
- Set `JWT_SECRET` in `.env`.
- Ensure `ConfigModule.forRoot({ isGlobal: true })` is loaded (already in `AppModule`).

### OAuth `redirect_uri_mismatch`

Cause:
- Callback URL in provider console does not match app value.

Fix:
- Verify exact match for:
  - `GOOGLE_CALLBACK`
  - `GITHUB_CALLBACK`

### Cookie not set in local development

Current Google callback sets cookie with:
- `secure: true`
- `sameSite: 'none'`

On plain `http://localhost`, secure cookies may not persist.

Options:
- Use HTTPS locally, or
- Make cookie security conditional by environment in controller.

### PostgreSQL SSL warning about `sslmode=require`

You may see a warning from `pg`/`pg-connection-string` about future SSL mode behavior.

Recommended:
- Prefer `sslmode=verify-full` with proper certificates in production.

## Security Notes

- Never commit real secrets in `.env`.
- Rotate any secrets that were exposed.
- Use strong, unique `JWT_SECRET` values.
- Restrict CORS `origin` to trusted frontend URL(s).
- Validate and sanitize DTO inputs.
- Consider encrypting stored provider tokens at rest.

## Production Checklist

1. Set `NODE_ENV=production`.
2. Use a managed PostgreSQL instance with TLS (`sslmode=verify-full`).
3. Use secure secret management (Vault/SSM/GCP Secret Manager).
4. Enable structured logging and monitoring.
5. Configure rate limiting and helmet.
6. Decide one token transport strategy:
   - `Authorization` header (already supported), or
   - HttpOnly cookie (requires JWT extractor update).
7. Add refresh token flow and revocation strategy.
8. Add automated tests for OAuth callbacks and guarded routes.

---

If you want, I can also add:
- Swagger/OpenAPI docs (`/docs`) for all routes
- an `.env.example` file
- a Postman collection for OAuth + JWT testing
- cookie-based JWT extraction in `JwtStrategy`
