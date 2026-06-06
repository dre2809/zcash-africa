# Zcash Africa — Backend Architecture

This document explains the structure of the Zcash Africa platform backend and
the reasoning behind its major decisions. It assumes familiarity with Next.js
App Router, Prisma, and PostgreSQL.

## 1. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Co-locates Route Handlers, server components, and middleware in one deployable; first-class Vercel support; React Server Components reduce client JS for content-heavy pages. |
| Language | TypeScript (strict) | Prisma + Zod + NextAuth all ship strong types; strict mode catches null/undefined bugs before they reach production across four community admin teams with varying technical depth. |
| Database | PostgreSQL | Relational integrity for users/roles/communities; native full-text search (`tsvector`/`tsquery`) and array/JSON column types cover search and tags without extra infrastructure. |
| ORM | Prisma | Type-safe queries, migrations as code, and a schema that doubles as living documentation of relationships. |
| Editorial CMS | Sanity | Gives non-technical community admins a polished editing experience for long-form content (blog bodies, landing sections, translations) without building a custom rich-text editor. |
| Auth | Auth.js (NextAuth v5) | Native Next.js App Router support, Prisma adapter, JWT sessions that scale across serverless functions without sticky sessions. |
| Media | Cloudinary | Signed uploads keep secrets server-side; automatic format/quality transforms matter for low-bandwidth users across the continent. |
| Hosting | Vercel | Zero-config Next.js deploys, edge middleware, cron jobs, and preview deployments per PR. |

## 2. Why PostgreSQL *and* Sanity?

These two stores are deliberately split by **what kind of data they hold**,
not by feature area:

- **PostgreSQL/Prisma** owns *structured, relational, transactional* data:
  users, roles, community membership, RSVPs, analytics counters, search
  indexes — anything the app must join, filter, paginate, or enforce
  referential integrity on.
- **Sanity** owns *editorial, long-form, frequently-translated* content:
  rich-text blog bodies, landing-page sections, multi-language UI strings.
  Editors get a familiar document-editing UI, content previews, and version
  history without us building any of that.

`BlogPost.content` in Prisma is typed as `Json` and can hold either inline
Portable Text (for simple posts authored directly in the dashboard) or a
reference to a Sanity document ID (for richly designed editorial features).
This keeps the **status/workflow** (draft → pending → published, who approved
it, which community it belongs to) inside our access-controlled database,
while letting Sanity handle **rendering and translation** of the prose itself.
Teams that don't need Sanity's editorial workflow can ignore it entirely and
store plain Portable Text JSON.

## 3. Folder structure

```
zcash-africa/
├─ prisma/
│  ├─ schema.prisma          # Single source of truth for the data model
│  └─ seed.ts                # Idempotent seed script (4 launch communities)
├─ src/
│  ├─ app/
│  │  └─ api/                # Route Handlers (REST-ish JSON API)
│  │     ├─ communities/
│  │     ├─ events/
│  │     ├─ posts/
│  │     ├─ ambassadors/
│  │     ├─ media/
│  │     ├─ search/
│  │     ├─ newsletter/
│  │     ├─ dashboard/
│  │     │  ├─ admin/
│  │     │  └─ community/[id]/
│  │     └─ auth/[...nextauth]/
│  ├─ lib/
│  │  ├─ prisma.ts           # Singleton Prisma client (hot-reload safe)
│  │  ├─ auth.ts             # Auth.js configuration + session typing
│  │  ├─ cloudinary.ts       # Signed upload + transform helpers
│  │  ├─ sanity.ts           # Sanity client + GROQ fragments
│  │  ├─ rate-limit.ts       # In-memory limiter (swap for Upstash in prod)
│  │  └─ api-response.ts     # Consistent JSON envelope + pagination helpers
│  ├─ middleware/
│  │  └─ rbac.ts             # requireAuth / requireRole / requireCommunityAccess
│  └─ schemas/               # Zod input validation, one file per resource
├─ middleware.ts             # Edge middleware: security headers + route guards
├─ next.config.ts
├─ vercel.json               # Build command, headers, cron config
└─ .env.example
```

This mirrors a clean-architecture separation: **route handlers** are thin
controllers, **schemas** validate at the boundary, **lib/** holds
infrastructure concerns, and **middleware/** holds cross-cutting policy
(authorization). Nothing in `lib/` imports from `app/`, which keeps the
dependency graph one-directional and testable.

## 4. Data model highlights

The full model lives in `prisma/schema.prisma`. Notable decisions:

- **`Community` is the tenancy boundary.** Every content type
  (`Event`, `BlogPost`, `Ambassador`, `Media`) carries a `communityId` with
  `onDelete: Cascade`, and `User.communityId` is nullable (null = platform-wide,
  i.e. Super Admin). This makes adding a fifth, sixth, or twentieth community a
  matter of inserting a row — no schema change, no new code paths.
- **Slugs are the public identifier** for `Community`, `Event`, and `BlogPost`
  (all `@unique`, indexed). The spec lists `PUT/DELETE /api/communities/[id]`,
  but the implementation consistently keys mutating routes off `slug` (see
  `src/app/api/communities/[slug]/route.ts`). This was a deliberate choice:
  slugs are already the public, SEO-relevant identifier, so using them
  end-to-end avoids a second lookup key and keeps URLs human-readable in admin
  tooling. If a strict numeric/CUID `[id]` route is required for a specific
  integration, it can be added as a thin alias that resolves to the same
  handler.
- **`ContentStatus` enum (`DRAFT`/`PENDING`/`PUBLISHED`)** is shared by
  `Event` and `BlogPost`, encoding the Contributor → Admin → Published
  workflow directly in the schema rather than as ad-hoc string fields.
- **`searchVector` columns** on `Event` and `BlogPost` are placeholders for a
  PostgreSQL generated `tsvector` column (added via a raw-SQL migration once
  the schema stabilizes); the current search route uses `ILIKE`-style
  `contains` filters, which are simpler to reason about during early
  development and can be swapped for `to_tsquery` ranking with no API change.
- **NextAuth tables (`Account`, `Session`, `VerificationToken`)** live in the
  same schema so Prisma's adapter can manage them — keeping auth state and
  application state in one transactional database avoids consistency drift.
- **`NewsletterSubscriber`** and the nullable `User.communityId` are
  future-proofing seams (see §8).

## 5. Role-based access control

Roles are defined once, in the database, via the `UserRole` enum
(`SUPER_ADMIN`, `COMMUNITY_ADMIN`, `CONTRIBUTOR`, `PUBLIC`) and carried through
the JWT (`src/lib/auth.ts` callbacks) so route handlers never need an extra DB
round-trip to authorize a request.

`src/middleware/rbac.ts` exposes three composable guards:

- `requireAuth()` — any signed-in user
- `requireRole(roles[])` — caller's role must be in the allow-list
- `requireCommunityAccess(communityId)` — Super Admins pass unconditionally;
  Community Admins must own the target community; everyone else is rejected

Route handlers call these at the top of each mutating action, e.g.:

```ts
const { error } = await requireCommunityAccess(existing.communityId);
if (error) return error;
```

This keeps authorization logic in one auditable place rather than scattered
`if (session.user.role === ...)` checks throughout the codebase. The
**first user ever created is auto-promoted to `SUPER_ADMIN`** (see the
`createUser` event in `auth.ts`), so the platform always has an owner without
a manual database edit on first deploy.

Edge `middleware.ts` adds a second layer: it redirects unauthenticated
dashboard visits to sign-in and rejects non-admin requests to `/api/admin/*`
before they reach a route handler, reducing load on the database for
obviously-unauthorized requests.

## 6. API design

All routes return a consistent envelope via `src/lib/api-response.ts`:

```jsonc
// success
{ "success": true, "data": { ... }, "meta"?: { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
// error
{ "success": false, "error": "message", "code"?: "MACHINE_READABLE_CODE" }
```

A consistent envelope means the frontend can write one response-handling
utility instead of per-endpoint parsing logic, and `code` fields let the UI
react to specific conditions (e.g. `SLUG_CONFLICT`) without string-matching
error messages.

Each mutating route follows the same pipeline: **rate limit → authenticate →
authorize → validate (Zod) → execute → respond**. Validation errors return
`400` with the first Zod issue's message; Prisma unique-constraint violations
(`P2002`) are translated into friendly `400`s rather than leaking `500`s.

List endpoints use offset pagination (`parsePagination`) capped at
`pageSize ≤ 100` to prevent accidental full-table scans from the client side.

## 7. Search

`GET /api/search` queries communities, events, posts, and ambassadors in
parallel-ish (sequential awaits, but independent queries) and supports
scoping by `type`, `communityId`, and blog `category`. It currently uses
case-insensitive `contains` filters — straightforward to reason about and
sufficient at launch volume. The route is already shaped so that swapping the
`where` clauses for `to_tsvector @@ to_tsquery(...)` raw queries (once
generated `tsvector` columns are migrated in) requires no changes to the
response contract or the frontend.

## 8. Future-proofing seams already in the schema/API

| Requirement | How the current design supports it |
|---|---|
| **Additional communities** | `Community` is a normal table row; no code changes needed to add a fifth chapter. Seed script demonstrates the pattern for four. |
| **Multi-language (EN/FR/SW)** | `NEXT_PUBLIC_SUPPORTED_LOCALES` env var + Sanity `translationSet`/`locale` documents (see `src/lib/sanity.ts` GROQ fragments). Prisma content tables stay locale-agnostic; translated prose lives in Sanity, keyed by locale. |
| **Newsletter integration** | `NewsletterSubscriber` model + `/api/newsletter` route + pluggable `NEWSLETTER_PROVIDER` env var (defaults to Resend audiences). |
| **Event registration** | `Event.attendance` plus the `ContentStatus` workflow give a foundation; an `EventRegistration` join table (`eventId`, `userId`/`email`, `status`) can be added without touching existing models. |
| **Community membership system** | `User.communityId` already models "belongs to community"; a richer `Membership` join table (with role/joinedAt) can layer on top when self-service joining is needed. |
| **Grant application tracking** | A `GrantApplication` model (communityId, applicantId, amount, status, reviewerId) follows the same `ContentStatus`-style workflow already established for posts/events. |
| **Partner directory** | A `Partner` model (name, logo, description, category, communityId?) mirrors `Ambassador`'s shape — same CRUD/RBAC patterns apply. |

## 9. Security

- **Authentication**: Auth.js with the Prisma adapter, JWT session strategy
  (stateless — scales horizontally on Vercel's serverless functions).
- **Authorization**: layered — edge middleware for coarse route protection,
  `rbac.ts` guards for fine-grained, resource-scoped checks inside handlers.
- **Validation & sanitization**: every mutating endpoint validates its body
  with a Zod schema before touching the database; rich-text fields destined
  for HTML rendering should be passed through `isomorphic-dompurify` at the
  render boundary (included as a dependency for this purpose).
- **Rate limiting**: `src/lib/rate-limit.ts` provides a per-IP sliding-window
  limiter. It's in-memory (fine for a single region / low launch traffic) with
  a documented upgrade path to `@upstash/ratelimit` (Redis-backed) for
  multi-region deployments where instances don't share memory.
- **CSRF**: mitigated via same-origin cookies (Auth.js default) plus security
  headers set in `middleware.ts`. State-changing requests rely on the
  `SameSite=Lax` session cookie and JSON content-type checks rather than a
  separate CSRF token system, which is the standard, low-friction approach for
  same-origin Next.js apps.
- **Headers**: `middleware.ts` sets `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, a scoped `Content-Security-Policy`
  (only Cloudinary/OAuth-avatar hosts allowed for images), and
  `Permissions-Policy` denying camera/mic/geolocation by default.

## 10. Performance

- **Pagination** everywhere lists are returned (`parsePagination`, capped page sizes).
- **Indexes**: every foreign key (`communityId`, `authorId`, `uploadedById`)
  and every field used in `WHERE`/`ORDER BY` (`status`, `slug`, `eventDate`,
  `category`, `publishedAt`, `email`, `role`) has an explicit `@@index` in
  `schema.prisma`.
- **Selective field projection**: list/detail queries use `select`/`include`
  with explicit field lists rather than returning full rows, reducing payload
  size and avoiding accidental exposure of internal fields.
- **`_count` aggregation** is used for dashboard/community stats instead of
  fetching full related rows and counting client-side.
- **Image optimization**: Cloudinary `fetch_format: auto` + `quality: auto` +
  responsive breakpoints, paired with `next/image` remote patterns scoped to
  known hosts (see `next.config.ts`).
- **Caching**: Sanity reads use the CDN-backed client (`useCdn: true`) for
  published content; Next.js route handlers can opt into `revalidate` /
  `fetch` caching per-route as traffic patterns emerge. A Vercel cron
  (`vercel.json` → `/api/cron/refresh-stats`) is scaffolded for periodically
  warming dashboard aggregate statistics.

## 11. Deployment

`vercel.json` configures:

- **Build**: `prisma generate && prisma migrate deploy && next build` —
  migrations run automatically on each production deploy, so the schema and
  code are always in lockstep.
- **Region**: `fra1` (Frankfurt) — chosen as the Vercel region with the lowest
  typical latency to African ISPs among currently-supported regions; revisit
  if Vercel adds an African region.
- **Headers**: API responses get baseline security headers; static assets get
  long-lived immutable caching.
- **Crons**: a placeholder six-hourly job for refreshing cached dashboard
  statistics — implement `/api/cron/refresh-stats` when aggregate queries
  become expensive enough to warrant pre-computation.

Environment variables are documented in `.env.example` and must be mirrored in
the Vercel project settings for each environment (Development/Preview/Production).

## 12. Local development

```bash
cp .env.example .env.local      # fill in real credentials
npm install
npm run db:migrate              # creates tables from schema.prisma
npm run db:seed                 # populates 4 communities + sample content
npm run dev
```

`npm run db:seed` is idempotent (upserts on unique fields), so it's safe to
re-run against an existing dev database.
