# CLAUDE.md — MarketReach: Multi-Platform Marketplace Aggregator

## Project Overview
A full-stack Next.js 14 app that lets **sellers** generate AI-powered listings and post them simultaneously to multiple marketplaces, and lets **buyers** search all platforms in one unified view.

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui (manually installed, not via CLI)
- **Database**: PostgreSQL + Prisma ORM (`src/lib/db/prisma.ts`)
- **Auth**: NextAuth.js v4 — JWT strategy, credentials + Google OAuth
- **AI**: Claude API via `@anthropic-ai/sdk` — model `claude-sonnet-4-6`
- **Queue**: BullMQ + Redis (worker runs as a separate process)
- **Browser Automation**: Playwright (for Facebook, Craigslist, OfferUp)
- **Image Storage**: Cloudinary
- **Package Manager**: npm

## Project Structure
```
src/
  app/
    auth/login & register/           # Public auth pages
    (dashboard)/                     # Protected layout (redirects if no session)
      dashboard/                     # Listing overview + status
      listings/new/                  # 3-step listing wizard
      listings/[id]/                 # Detail + platform status
      platforms/                     # Connect/disconnect marketplace accounts
    search/                          # Public buyer search page
    api/
      auth/[...nextauth]/            # NextAuth handler
      auth/register/                 # POST: create account
      listings/                      # GET/POST listings
      listings/[id]/                 # GET/PATCH/DELETE
      listings/generate/             # POST: AI generation via Claude
      platforms/list/                # GET: user's connected platforms
      platforms/[platform]/connect/  # POST: connect, DELETE: disconnect
      platforms/ebay/callback/       # eBay OAuth callback
      platforms/etsy/callback/       # Etsy OAuth callback
      post/                          # POST: enqueue BullMQ posting jobs
      search/                        # GET: aggregated search across platforms
      upload/                        # POST: Cloudinary image upload
  lib/
    auth.ts                          # NextAuth config
    encryption.ts                    # AES-256-GCM encrypt/decrypt for stored creds
    utils.ts                         # cn() helper
    db/prisma.ts                     # Prisma singleton
    ai/listing-generator.ts          # Claude API calls (base64 image input)
    queue/posting-queue.ts           # BullMQ Queue definition + enqueue helper
    platforms/
      ebay.ts                        # eBay REST API (Inventory + Browse)
      etsy.ts                        # Etsy Open API v3
      facebook.ts                    # Playwright automation
      craigslist.ts                  # Playwright automation
      offerup.ts                     # Playwright scraping
  components/
    providers.tsx                    # SessionProvider wrapper
    dashboard-nav.tsx                # Sticky nav for dashboard routes
    ui/                              # shadcn/ui components (button, card, etc.)
workers/
  posting-worker.ts                  # BullMQ Worker — run with npm run worker
prisma/
  schema.prisma                      # Full data model
```

## Key Architectural Decisions

### Platform Auth Strategy
- **eBay + Etsy**: Full OAuth 2.0 (tokens stored encrypted in DB)
- **Facebook, Craigslist, OfferUp**: No public API — user provides email/password, stored AES-256-GCM encrypted in `PlatformConnection.credentials` JSON field
- Etsy uses PKCE OAuth flow

### BullMQ Connection
BullMQ bundles its own version of ioredis internally. **Do NOT pass an external ioredis instance** as the connection — it causes type conflicts. Instead, pass a plain options object:
```ts
const redisConnection = { host, port, password, maxRetriesPerRequest: null }
```

### AI Image Input
The installed `@anthropic-ai/sdk` (v0.27.x) only supports `type: "base64"` image sources. Images are fetched from Cloudinary URLs and converted to base64 before being sent to Claude.

### Session Type Augmentation
`src/types/next-auth.d.ts` extends the Session type to include `user.id`. Always use `session.user.id` for DB queries (never `session.user.email`).

## Database Schema Key Points
- `PlatformConnection` has a `@@unique([userId, platform])` constraint — use `upsert` when connecting
- `Listing.images` and `Listing.tags` are `String[]` (PostgreSQL array)
- `PlatformListing.status` uses enum: `PENDING | POSTING | SUCCESS | FAILED`
- All tokens/credentials are stored encrypted — always call `encrypt()`/`decrypt()` from `src/lib/encryption.ts`

## Environment Variables Required
```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
CLAUDE_API_KEY
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
EBAY_CLIENT_ID / EBAY_CLIENT_SECRET / EBAY_SANDBOX_MODE / EBAY_REDIRECT_URI
ETSY_CLIENT_ID / ETSY_CLIENT_SECRET / ETSY_REDIRECT_URI
REDIS_URL
ENCRYPTION_KEY   # 32-byte hex string — generate with: openssl rand -hex 32
```

## Running the App
```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run worker       # BullMQ posting worker (separate terminal — required for posting)
npm run db:push      # Push Prisma schema to PostgreSQL
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:studio    # Prisma Studio GUI
npm run build        # Production build
```

## Important Conventions
- All protected API routes check `getServerSession(authOptions)` — return 401 if no session
- All platform-specific posting logic lives in `src/lib/platforms/` — the worker calls these
- The worker (`workers/posting-worker.ts`) must be running for any platform posting to execute
- Playwright browsers run headless; instantiated and closed per-request (not pooled)
- Image uploads go to Cloudinary; URLs stored in `Listing.images[]`
- The search endpoint fires all platform searches in parallel with `Promise.all()`

## Phases Completed
- **Phase 1**: Foundation (Next.js, Prisma, NextAuth, Cloudinary upload)
- **Phase 2**: AI Generation (Claude API → listing form pre-fill)
- **Phase 3**: Platform Integrations — eBay + Etsy OAuth, BullMQ queue
- **Phase 4**: Browser Automation — Facebook, Craigslist, OfferUp via Playwright
- **Phase 5**: Buyer Search UI — unified search with platform filter pills

## Git Workflow
Follow good software development practices for all changes:

- **Use branches** — never commit feature work directly to `master`. Create a branch per feature/fix:
  ```bash
  git checkout -b feature/my-feature-name
  ```
- **Commit frequently** — small, logical commits after each meaningful change (not just at the end of a session)
- **Descriptive commit messages** — summarize the "why", not just the "what"
- **Merge via PR** — push the branch to GitHub and merge into `master` so there's a clear history and easy revert points
- **Before starting any significant work**, create a branch so the current `master` state is always a safe rollback point

## GitHub
https://github.com/sglinski96/marketplace-aggregator
