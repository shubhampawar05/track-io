# Trackio API (Backend)

Express 5 + MongoDB (Mongoose) + JWT (httpOnly cookie). All project and issue routes require a valid **`X-Organization-Id`** header and organization membership.

## Prerequisites

- **Node.js** (LTS recommended)
- **MongoDB** — this guide assumes **[MongoDB Atlas](https://www.mongodb.com/atlas)**. You can also use a local instance with `mongodb://127.0.0.1:27017/trackio`.

## MongoDB Atlas (quick checklist)

1. Create a **cluster** (free tier is fine).
2. **Database Access**: create an application user (username + password). You will embed these in the connection string.
3. **Network Access**: add your current IP, or for quick local development only you may use `0.0.0.0/0` (less secure; tighten before production).
4. **Connect** → Drivers → copy the **SRV** connection string. Replace `<password>` with your user password. Use a database name at the end of the path (e.g. `/trackio`) if you want data isolated.

**Security:** never commit real credentials. This repo ignores `.env`; keep secrets only on your machine or in your deployment platform.

## Environment variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `4000`). |
| `MONGODB_URI` | Atlas SRV URI or local Mongo URI. |
| `JWT_SECRET` | At least 16 characters in production. A dev fallback exists only when `NODE_ENV` is not `production`. |
| `FRONTEND_ORIGIN` | Exact origin of the Next app (e.g. `http://localhost:3000`) for CORS and cookies. |
| `API_PUBLIC_URL` | Optional. Public base URL of this API (no trailing slash), e.g. `http://localhost:4000`. Used when the seed logs the demo GitHub webhook URL and for trusted attachment URLs. |
| `NODE_ENV` | `development` or `production`. |
| `SKIP_STARTER_ISSUES` | Optional. Set to `true` to skip creating the three **getting-started** issues when a new project is created (default is to create them). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional. Enable GitHub OAuth for the Integrations page. |
| `GITHUB_OAUTH_CALLBACK_URL` | Full URL to `GET /api/integrations/github/callback` (must match the GitHub OAuth App callback URL). |
| `GITHUB_OAUTH_ENCRYPTION_KEY` | Optional in development (falls back to hashing `JWT_SECRET`). In **production**, required (min 16 characters) when `GITHUB_CLIENT_ID` is set; used to encrypt stored OAuth tokens. |
| `OPENAI_API_KEY` | Required for transcription extraction endpoint (`POST /api/transcriptions/extract`). |
| `OPENAI_MODEL` | Optional. OpenAI model used for extraction (default `gpt-4.1-mini`). |
| `OPENAI_TRANSCRIBE_MODEL` | Optional. OpenAI model for audio-to-text transcription (default `gpt-4o-mini-transcribe`). |

**New projects:** each `POST /api/projects` creates three starter issues (todo, in-progress, backlog) so new workspaces are not empty. Use `SKIP_STARTER_ISSUES=true` in `.env` if you want only empty projects.

### GitHub OAuth (optional)

1. Create an **OAuth App** under GitHub → **Settings** → **Developer settings** → **OAuth Apps**.
2. Set **Authorization callback URL** to your backend callback, e.g. `http://localhost:4000/api/integrations/github/callback`, and copy the same value into `GITHUB_OAUTH_CALLBACK_URL` in `.env`.
3. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a strong `GITHUB_OAUTH_ENCRYPTION_KEY` (see table above).
4. Ensure `FRONTEND_ORIGIN` matches your Next.js origin; after OAuth, the API redirects the browser there with `?github=connected` or `?github=error`.

**Endpoints** (all require a logged-in session except that the callback relies on the same httpOnly cookie):

- `GET /api/organizations/github/status` — `{ connected, githubLogin }` (any org member; `X-Organization-Id` required).
- `GET /api/organizations/github/oauth-url` — `{ url }` redirect target (owners and admins only).
- `DELETE /api/organizations/github` — disconnect (owners and admins only).
- `GET /api/integrations/github/callback?code=&state=` — completes OAuth and redirects to the frontend `/integrations` route.

**GitHub PR / branch linking (webhooks):**

- `POST /api/organizations/github/webhook-setup` (owners/admins, `X-Organization-Id`) — returns `{ webhookUrl, secret }`. Configure that URL and secret in GitHub → repo → **Webhooks** (content type `application/json`, events: `pull_request`, `push`). Rotating generates a new secret.
- `POST /api/integrations/github/webhook/:webhookPathToken` — **public** endpoint; raw JSON body; verifies `X-Hub-Signature-256`. GitHub calls this URL; the server matches `repository.full_name` to a project’s **`githubRepoFullName`** (`PATCH /api/projects/:slug` with `{ "githubRepoFullName": "owner/repo" }` or clear with `null`) and parses issue keys from branch names / PR title / body.

Example Atlas-style value (placeholder — not a real cluster):

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/trackio?retryWrites=true&w=majority
```

## Install and run

```bash
cd Backend
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI (and JWT_SECRET for production)
```

### Reset database (wipe demo / local data)

Removes all documents from the Trackio collections (`User`, `Organization`, `Membership`, `Project`, `Issue`, `Comment`, `Sprint`, `OrganizationInvite`, `GithubIntegration`, `TranscriptionRecording`). Other collections in the same MongoDB database are untouched.

```bash
npm run db:reset
```

> **Safety guard:** `db:reset` and `seed` always refuse when `NODE_ENV=production`, and refuse any non-local MongoDB (e.g. Atlas) unless you name the database explicitly:
>
> ```bash
> npm run db:reset -- --allow-remote=trackio
> ```

### Maintenance scripts (safe for production)

Both print the target database and do nothing without `--dry-run` (preview) or `--yes` (apply). Both are idempotent.

| Command | What it does |
|---|---|
| `npm run migrate:secrets -- --yes` | Re-encrypts stored GitHub OAuth tokens and webhook secrets with the current `GITHUB_OAUTH_ENCRYPTION_KEY` (v2 versioned format). Run after first setting the key and after every key rotation. Add `--delete-undecryptable-tokens` to drop GitHub connections no configured key can decrypt (those workspaces reconnect GitHub). |
| `npm run migrate:sort-order -- --yes` | Renumbers board card positions per project column (1000, 2000, …) keeping the current order. Run once on existing data. |

**Upgrading GitHub secret encryption on an existing deployment**

1. Generate a key: `openssl rand -base64 48` → `GITHUB_OAUTH_ENCRYPTION_KEY`.
2. If you had an older key set, move it to `GITHUB_OAUTH_ENCRYPTION_KEY_PREVIOUS`. If you never had one, keep the current `JWT_SECRET` unchanged for now (old tokens were derived from it).
3. Deploy, then `npm run migrate:secrets -- --dry-run` and `npm run migrate:secrets -- --yes`.
4. Now you can remove the old key / rotate `JWT_SECRET`. Webhooks keep working throughout (legacy plaintext secrets are accepted until migrated).

### Tests

```bash
npm test          # vitest + supertest against an in-memory MongoDB (or TEST_MONGODB_URI)
npm run typecheck # src + tests
```

Tests force empty SMTP/OpenAI/GitHub settings, so they never use the real services in your `.env`.

### Seed demo data (optional, first-time)

Creates a full demo workspace: members (including an **admin**), custom board columns, sprints, issues (all statuses and priorities, subtasks with links, attachments, GitHub links), comments, pending/cancelled invites, transcription rows, GitHub OAuth row (placeholder token), and org webhook URL fields. The script prints the **webhook URL** and **pending invite token** to the console when it finishes.

**Idempotent:** if `demo@track.io` already exists, the script exits without changing data. To load a fresh dataset:

```bash
npm run db:reset && npm run seed
```

Seed only (when the DB is already empty or demo user was removed):

```bash
npm run seed
```

### Start the API

```bash
npm run dev
```

The server listens on `http://localhost:${PORT}` (default **4000**).

### Swagger / OpenAPI docs

Once the API is running, open:

- `http://localhost:4000/api/docs` — interactive Swagger UI
- `http://localhost:4000/api/openapi.json` — raw OpenAPI document

The docs reflect the current Express routes in this repo, including auth, organizations, projects, issues, uploads, and GitHub integration endpoints.

### Production build

```bash
npm run build
npm start
```

## Demo data and credentials

These apply after a successful `npm run seed` (see [Seed demo data](#seed-demo-data-optional-first-time)).

### Sign-in (all use the same password)

| Role | Email | Password |
|------|--------|----------|
| Owner (primary demo) | `demo@track.io` | `password123` |
| Admin (workspace settings / invites) | `alice@track.io` | `password123` |
| Members | `john@track.io`, `mark@track.io`, `ryan@track.io` | `password123` |

Sign in through the frontend against this API after seeding so the board, integrations, invites, and issue views have data.

### Pending invitation (accept-invite flow)

| Field | Value |
|--------|--------|
| Invited email | `pending@track.io` |
| Invite token (query string `token=`) | `trackio-seed-invite-pending-user` |

Create a user with that email (or sign up as `pending@track.io`), then open  
`{FRONTEND_ORIGIN}/accept-invite?token=trackio-seed-invite-pending-user`  
or call `GET /api/auth/invite-preview?token=…` / `POST /api/auth/accept-invite` with the same token.

### GitHub integration (seed)

The seed stores a **placeholder** OAuth token so the API reports GitHub as connected for **`trackio-seed-bot`**. It is not a valid GitHub session; use **Disconnect** and complete real OAuth for API calls that need GitHub.

### Webhook URL (seed)

After `npm run seed`, the script logs the demo **GitHub webhook URL** (built from `API_PUBLIC_URL` if set, otherwise `http://localhost:${PORT}`). The org also has a generated webhook secret in the database for HMAC verification demos.

## API shape

- JSON responses: `{ success, data, error }` (see workspace `.cursor/rules/api.mdc`).
- Auth cookie name: **`trackio_token`** (httpOnly). Login and register set it; logout clears it.
- Protected data routes expect header: **`X-Organization-Id`** (MongoDB ObjectId string of the organization). The `GET /api/auth/me` response includes `organizations` and `currentOrganizationId`; if you send `X-Organization-Id` on `/me`, that org is preferred when you are a member.
- **`PATCH /api/auth/me`** — update profile `{ name }` (returns same shape as `/me`).
- **`GET /api/organizations/members`** / **`PATCH /api/organizations`** — list members or rename the workspace (`{ name }`, owners and admins only); both require `X-Organization-Id`.
- **GitHub** — see [GitHub OAuth (optional)](#github-oauth-optional) for `github/status`, `github/oauth-url`, `github` (DELETE), and the callback route.

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| `MongoServerError` / auth failed | User/password in `MONGODB_URI`, URL-encoding special characters in the password. |
| Connection timeout | Atlas **Network Access** allows your IP; VPN or corporate firewall blocking outbound 27017/SRV. |
| CORS errors from the browser | `FRONTEND_ORIGIN` must match the Next.js origin exactly (scheme + host + port). |
| `401` on API after login | Same-site cookie: frontend must use `NEXT_PUBLIC_API_BASE_URL` pointing at this API and `credentials: "include"` (already set in the frontend client). |
| Production `JWT_SECRET` error | Set a strong `JWT_SECRET` (16+ chars) when `NODE_ENV=production`. |

## Project layout

- `src/server.ts` — entrypoint
- `src/app.ts` — Express app
- `src/routes`, `src/controllers`, `src/services`, `src/models`, `src/middleware`

For product rules (organizations, memberships, indexing), see the repo `.cursor/rules/` files.
