# Trackio (Frontend)

Next.js (App Router) + TypeScript + Tailwind CSS + TanStack Query + Zustand. The UI talks to the **Trackio Express API**; there is no in-browser mock API.

## Prerequisites

- **Node.js** (LTS recommended)
- **Backend** running and reachable at the URL you configure (see below). For local development that is usually `http://localhost:4000`.
- **Demo data (optional):** in [Backend](../Backend), run `npm run db:reset && npm run seed` for a full wipe + reload, or `npm run seed` on an empty database. Sign in as `demo@track.io` / `password123` (see [Backend README — Demo data and credentials](../Backend/README.md#demo-data-and-credentials)). If you **sign up** instead, you get a real empty workspace; **creating a project** still adds a few **starter issues** from the API so the list/board is not blank.

## Environment variables

Copy `.env.example` to `.env.local` (Next.js reads this for local overrides):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API, **no trailing slash**. Default in code is `http://localhost:4000` if unset. |

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

If the API runs elsewhere (another port, tunnel, or staging host), set this to that origin.

## Install and run

```bash
cd Frontend
npm install
cp .env.example .env.local
# Edit .env.local if your API is not on http://localhost:4000
```

### Recommended first-time flow

1. Configure **MongoDB Atlas** (or local Mongo) and `Backend/.env` with `MONGODB_URI`.
2. In `Backend`: `npm install` → `npm run db:reset && npm run seed` (or `npm run seed` if the DB is already empty) → `npm run dev`.
3. In `Frontend`: `npm run dev`.
4. Open the app (default [http://localhost:3000](http://localhost:3000)), **Sign in** with `demo@track.io` / `password123` after seeding, or **Sign up** to create a new workspace (no seed required). Extra demo accounts and invite tokens are listed in the [Backend README](../Backend/README.md#demo-data-and-credentials).

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (Turbopack). |
| `npm run build` | Production build. |
| `npm start` | Run production server (after `build`). |
| `npm run lint` | ESLint. |

## How the app calls the API

- Requests use `fetch` with **`credentials: "include"`** so the httpOnly JWT cookie set by the API is sent on cross-origin requests to `NEXT_PUBLIC_API_BASE_URL`.
- Authenticated org-scoped calls send **`X-Organization-Id`** from the auth/me payload (`currentOrganizationId`), stored in client state after login or hydrate.

Ensure the API’s **`FRONTEND_ORIGIN`** matches this app’s origin or the browser will block CORS.

## Projects page (what is “real” vs placeholder)

- Project **name**, **status**, **progress**, **member count**, and **slug** come from the API.
- Older builds showed decorative avatar chips and a kebab icon that were not wired to data; the current UI keeps only the **member count** row so it matches the API.

## List view (Issue Pipeline tabs)

On a project’s **List** view, **All Issues**, **Active**, **Backlog**, and **Priority** are real filters: Active shows `todo` and `in-progress`; Backlog shows `backlog`; Priority sorts by priority (urgent first). The **Filters** button still opens the side panel (saved views there are separate from these tabs).

## Issues board (columns)

- Column layout is stored on the **API**: each **project** has `boardColumns` (`GET`/`PATCH /api/projects/:slug`), and the **all-issues** board uses `GET /api/organizations/issues-board-columns` plus `PATCH /api/organizations` with `issuesBoardColumns` (clear with `issuesBoardColumns: null` to fall back to a merged view of all project boards). Dragging a card **PATCH**es issue `status` on the API.
- **Add column**, **column menu** (rename / remove), and **reset to default** are available only to organization **`owner`** and **`admin`** (from `/api/auth/me`). **Members** see a read-only board.

## Integrations (GitHub)

The **Integrations** page loads GitHub connection status from the API and lets **owners** and **admins** connect or disconnect. Configure the GitHub OAuth App and backend env vars as described in [Backend README — GitHub OAuth](../Backend/README.md#github-oauth-optional).

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Network errors / failed fetch | Backend running; `NEXT_PUBLIC_API_BASE_URL` correct; no trailing slash mismatch. |
| Always logged out / `401` | Cookie is tied to the API host; URL must match where you logged in. CORS `FRONTEND_ORIGIN` on the server. |
| Empty projects or `400 Organization required` | Log in again so `currentOrganizationId` is applied; clear site data if state is stale. |
| No demo data | In Backend run `npm run db:reset && npm run seed` or `npm run seed` (see Backend README). |

## Structure (high level)

- `src/app` — routes (App Router)
- `src/components` — UI
- `src/hooks` — data hooks (TanStack Query)
- `src/stores` — auth and organization context
- `src/lib/api-client.ts` — API helper

For stack conventions, see `.cursor/rules/frontend.mdc` in the repo root.
