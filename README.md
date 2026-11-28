# Trackio

A Linear-style project and issue tracker for small product and engineering teams. People work inside an **organization (workspace)**: they invite teammates, create projects, track issues on a board or a list, discuss in comments, and can optionally link GitHub PRs/branches or turn meeting recordings into issues with AI.

This repository is a monorepo with two apps:

| Folder | What it is | Stack |
|---|---|---|
| [`Backend/`](Backend) | REST API (`http://localhost:4000`) | Node.js 20+, Express 5, TypeScript, MongoDB (Mongoose), JWT in an httpOnly cookie, Nodemailer, OpenAI, Vitest + Supertest |
| [`Frontend/`](Frontend) | Web app (`http://localhost:3000`) | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/Base UI, TanStack Query, Zustand, dnd-kit, Tiptap |

---

## Quick start (local development)

### 1. Prerequisites

- **Node.js 20.9 or newer** (22 is what CI uses)
- **MongoDB**: a local instance (recommended) or a MongoDB Atlas cluster. If you have Docker, this is the quickest way to get one:

```bash
docker run -d --name trackio-mongo -p 27017:27017 mongo:7
```

### 2. Start the API

```bash
cd Backend
npm install
cp .env.example .env
```

The defaults in `.env.example` work as-is against a local MongoDB on `127.0.0.1:27017`. For Atlas, set `MONGODB_URI` (see [Backend/README.md](Backend/README.md#mongodb-atlas-quick-checklist)).

Load the demo workspace (optional, but recommended the first time):

```bash
npm run db:reset && npm run seed
```

Run the API in watch mode:

```bash
npm run dev
```

The API is now at `http://localhost:4000`. Swagger UI is at `http://localhost:4000/api/docs` (enabled outside production).

### 3. Start the web app

In a second terminal:

```bash
cd Frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Sign in

After seeding, sign in with **`demo@track.io` / `password123`** (owner). Other seeded accounts, all with password `password123`:

| Role | Email |
|---|---|
| Owner | `demo@track.io` |
| Admin | `alice@track.io` |
| Members | `john@track.io`, `mark@track.io`, `ryan@track.io` |

Or click **Sign up** to create a fresh, empty workspace (no seed needed). Each new project gets three starter issues unless `SKIP_STARTER_ISSUES=true`.

> Without SMTP configured, password-reset and invite emails are printed to the API console instead of being sent, so you can copy the links from there.

---

## What the app does

- **Auth**: sign up, log in, log out, forgot/reset password. Sessions are a JWT in the httpOnly `trackio_token` cookie.
- **Workspaces and roles**: every user belongs to one or more organizations with the role `owner`, `admin` or `member`. All data is scoped to an organization (the `X-Organization-Id` header).
- **Invites**: owners and admins invite people by email; invitees accept via `/accept-invite?token=…`.
- **Projects**: grouped work with human-readable issue keys (e.g. `VE-12`), per-project board columns, and an optional linked GitHub repository.
- **Issues**: list and board views with drag-and-drop, status, priority, assignee, due date, label, subtasks, a rich-text description, comments and file attachments. There is also a cross-project board and a **My issues** view.
- **Sprints and roadmaps**: sprints per project and a roadmap view.
- **GitHub integration** (optional): connect GitHub via OAuth, then a repo webhook links branches and PRs to issues by their key.
- **Meeting → issues** (optional, needs `OPENAI_API_KEY`): record or upload audio, transcribe it, and extract proposed issues from the transcript.

---

## Repository layout

```
track-io/
├── Backend/                    Express API
│   ├── src/
│   │   ├── server.ts           entrypoint (connects to MongoDB, starts HTTP server)
│   │   ├── app.ts              Express app: middleware, routes, Swagger
│   │   ├── config/             environment parsing and validation (env.ts)
│   │   ├── routes/             auth, organizations, projects, issues, sprints,
│   │   │                       uploads, GitHub integration, transcriptions
│   │   ├── controllers/        request/response handling
│   │   ├── services/           business logic (issues, mail, GitHub, AI, …)
│   │   ├── models/             Mongoose models: User, Organization, Membership,
│   │   │                       OrganizationInvite, Project, Issue, Comment, Sprint,
│   │   │                       GithubIntegration, TranscriptionRecording
│   │   ├── middleware/         auth, org membership, CSRF origin check, rate limits,
│   │                           security headers, error handling
│   │   ├── docs/               OpenAPI spec served at /api/docs
│   │   └── scripts/            seed, db:reset, migrations
│   ├── tests/                  Vitest + Supertest API tests
│   └── uploads/                uploaded attachments (created at runtime, gitignored)
├── Frontend/                   Next.js app
│   └── src/
│       ├── app/                routes
│       │   ├── (auth)/         login, signup, reset-password, accept-invite
│       │   └── (dashboard)/    projects, issues (list / board / [id]), my-issues,
│       │                       roadmaps, integrations, settings, onboarding
│       ├── components/         UI components
│       ├── hooks/              data hooks (TanStack Query)
│       ├── stores/             Zustand stores (auth, organization, UI, recording)
│       └── lib/                API client and helpers
├── .github/workflows/ci.yml    CI: typecheck, lint, tests and build for both apps
├── DESIGN-DECISIONS.md         open issues that need a product/technical decision
└── REGRESSION-ISSUES.md        regression and bug audit (2026-11-28)
```

The `docs/` folder (PRD, architecture, security, frontend spec, feature tickets) and `.cursor/` rules are kept locally and are gitignored, so they may not exist in your clone.

---

## Configuration

Each app has a commented `.env.example` that lists every variable, its local default and what production needs.

**Backend (`Backend/.env`)**, the main ones:

| Variable | Needed for | Local default |
|---|---|---|
| `MONGODB_URI` | everything | `mongodb://127.0.0.1:27017/trackio` |
| `JWT_SECRET` | sessions (required in production, at least 32 chars) | placeholder, allowed in development |
| `FRONTEND_ORIGIN` | CORS, CSRF check, links in emails | `http://localhost:3000,http://localhost:3001` |
| `PORT` | API port | `4000` |
| `SMTP_*`, `MAIL_FROM` | sending reset/invite emails | unset (emails are logged to the console) |
| `OPENAI_API_KEY` | transcription and issue extraction | unset (feature disabled) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL`, `GITHUB_OAUTH_ENCRYPTION_KEY` | GitHub integration | unset (feature disabled) |

**Frontend (`Frontend/.env.local`)**:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API, no trailing slash (default `http://localhost:4000`). Baked in at build time, so never put secrets here. |

Full details: [Backend/README.md](Backend/README.md) and [Frontend/README.md](Frontend/README.md).

---

## Common commands

**Backend** (run inside `Backend/`):

| Command | Description |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run build` / `npm start` | Production build / run the build |
| `npm test` | API tests (in-memory MongoDB, or `TEST_MONGODB_URI` if set) |
| `npm run typecheck` | Type-check source and tests |
| `npm run seed` | Load the demo workspace (skips if `demo@track.io` already exists) |
| `npm run db:reset` | Wipe all Trackio collections (refuses production and remote databases unless forced) |
| `npm run migrate:secrets -- --yes` | Re-encrypt stored GitHub secrets after setting or rotating the encryption key |
| `npm run migrate:sort-order -- --yes` | Renumber board card positions (run once on existing data) |

**Frontend** (run inside `Frontend/`):

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm start` | Production build / run the build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |

CI (`.github/workflows/ci.yml`) runs typecheck, build and tests for the Backend, and lint, typecheck, tests and build for the Frontend, on every pull request and push to `main`.

---

## Production deployment (summary)

1. Build and run each app (`npm run build && npm start`) on your host of choice.
2. Backend: set `NODE_ENV=production`, a strong `JWT_SECRET`, a dedicated `MONGODB_URI`, `FRONTEND_ORIGIN` (exact deployed origin), `API_PUBLIC_URL`, `TRUST_PROXY` if behind a load balancer, SMTP, and the optional OpenAI/GitHub keys. The full checklist is at the top of `Backend/.env.example`.
3. Frontend: set `NEXT_PUBLIC_API_BASE_URL` to the public API URL **before** building.
4. On existing data, run `npm run migrate:sort-order -- --yes` once, and `npm run migrate:secrets -- --yes` after setting the GitHub encryption key.
5. Never run `seed` or `db:reset` against production.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| API won't start: MongoDB connection error | Check MongoDB is running and `MONGODB_URI` is right. For Atlas, allow your IP under Network Access. |
| Browser shows CORS errors, or writes fail with `403 Request origin not allowed` | `FRONTEND_ORIGIN` in `Backend/.env` must contain the exact frontend origin (scheme, host and port). |
| Logged in but every request returns `401` | `NEXT_PUBLIC_API_BASE_URL` must point at the same API host you logged in through. |
| `400 Organization required` / empty projects | Log out and back in, or clear site data, so the current organization is reloaded. |
| No demo data | Run `npm run db:reset && npm run seed` in `Backend/`. |
| `seed`/`db:reset` refuses to run against Atlas | Intended safety guard. Pass `-- --allow-remote=<dbName>` if you really mean it. |
