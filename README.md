# Zcash Africa

Backend platform for Zcash Africa — the central hub connecting Zcash
ambassador communities (Nigeria, Ghana, South Africa, East Africa, and future
chapters) through events, blog content, media galleries, and ambassador
profiles.

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL · Prisma · Sanity CMS ·
Auth.js · Cloudinary · Vercel

## Getting started

```bash
cp .env.example .env.local   # fill in database, OAuth, Cloudinary, Sanity credentials
npm install
npm run db:migrate           # apply the Prisma schema to your database
npm run db:seed              # seed sample data for all four launch communities
npm run dev
```

Visit `http://localhost:3000`.

## Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Generate Prisma client and build for production |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply migrations in production (run by Vercel build) |
| `npm run db:studio` | Open Prisma Studio to browse data |
| `npm run db:seed` | Seed example communities, ambassadors, events, and posts |

## Documentation

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full write-up of
architectural decisions: data model, RBAC design, API conventions, search,
security, performance, deployment, and future-proofing seams (multi-language
support, newsletter, event registration, membership, grants, partner
directory).

## Roles

- **Super Admin** — manages all communities, users, ambassadors, homepage content; approves posts and events; views analytics
- **Community Admin** — manages their own community: posts, event reports, gallery uploads, ambassador profiles
- **Contributor** — drafts blog posts and event reports (cannot publish)
- **Public User** — views published content, searches, subscribes to the newsletter
