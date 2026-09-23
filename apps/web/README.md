# CalmEar Web Platform

SaaS control plane for CalmEar: authentication, trial management, billing, and extension API.

Built with **Nuxt 4** · **Clerk** · **Stripe** · **Supabase PostgreSQL** · **Drizzle ORM**

---

## Requirements

- Node.js >= 20
- npm >= 10

---

## Setup

```bash
cd apps/web
npm install
cp .env.example .env
# Fill in .env values (see sections below)
npm run db:migrate
npm run dev
```

App runs at `http://localhost:3000`.

---

## Required Services

### Clerk

1. Create project at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable **Google** and **Email** sign-in
3. Set after sign-in/sign-up URL to `/dashboard`
4. Copy to `.env`: `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NUXT_CLERK_SECRET_KEY`

### Supabase (PostgreSQL)

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings → Database → Connection string → **Transaction** mode (port 6543)
3. Copy to `.env`: `NUXT_DATABASE_URL`
4. Run: `npm run db:migrate`

### Stripe

1. Create product `CalmEar Premium` with two recurring prices:
   - Monthly: €4.99/month
   - Annual: €39.99/year
2. Copy to `.env`: `NUXT_STRIPE_SECRET_KEY`, `NUXT_STRIPE_MONTHLY_PRICE_ID`, `NUXT_STRIPE_YEARLY_PRICE_ID`
3. Activate Customer Portal (Stripe Dashboard → Billing → Customer Portal)
4. Set up webhooks (see below): `NUXT_STRIPE_WEBHOOK_SECRET`

---

## Stripe Webhooks (Local Dev)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the printed whsec_... to NUXT_STRIPE_WEBHOOK_SECRET in .env
```

Production webhook events to enable:
- `checkout.session.completed`
- `customer.subscription.created/updated/deleted`
- `invoice.paid`, `invoice.payment_failed`

---

## Database Commands

```bash
npm run db:generate  # generate SQL from schema changes
npm run db:migrate   # apply migrations to database
npm run db:studio    # open Drizzle Studio GUI
```

---

## Dev Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run test         # unit tests
```

---

## Testing the Full Flow

### 1. Sign up & trial

Visit `http://localhost:3000` → click **Try CalmEar Free** → sign up → dashboard shows 30-day trial.

### 2. Pair extension (simulate)

```bash
# Dashboard: click "Connect Chrome Extension" → note the CALM-XXXX-XXXX code

curl -X POST http://localhost:3000/api/extension/activate \
  -H "Content-Type: application/json" \
  -d '{"code":"CALM-XXXX-XXXX"}'
# → {"token":"...","expiresAt":"..."}

curl http://localhost:3000/api/extension/entitlement \
  -H "Authorization: Bearer <token>"
# → {"active":true,"plan":"trial",...}
```

### 3. Subscribe

Dashboard → **Upgrade** → Stripe Checkout (test card: `4242 4242 4242 4242`) → webhook fires → entitlement returns `"plan":"premium"` without new token.

### 4. Cancel

Dashboard → **Manage Subscription** → Stripe Customer Portal → Cancel → webhook fires → entitlement reverts after period end.

---

## Project Structure

```
apps/web/
  app/
    pages/        index, pricing, dashboard, download
    layouts/      default (nav + footer)
    middleware/   auth.ts
    assets/css/   main.css
  server/
    api/
      user/       me.get.ts
      billing/    checkout.post.ts, portal.post.ts
      extension/  pairing-code.post.ts, activate.post.ts,
                  entitlement.get.ts, session.delete.ts
      webhooks/   stripe.post.ts
    services/     entitlement.ts, users.ts, stripe.ts, extension-auth.ts
    utils/        db.ts, auth.ts, crypto.ts
  config/         pricing.ts
  drizzle/        schema.ts, migrations/
  tests/          entitlement.test.ts, crypto.test.ts, extension-auth-logic.test.ts
  docs/           EXTENSION_INTEGRATION.md
```

---

## Deployment (Fly.io)

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for the full production
deployment guide: Docker image, Fly.io setup, secrets, DNS for
`calmear-app.com`, Clerk production, and Stripe live webhooks.

---

## Extension Integration

See [`docs/EXTENSION_INTEGRATION.md`](./docs/EXTENSION_INTEGRATION.md).

Minimal integration:
```ts
const { active } = await fetch('https://calmear.com/api/extension/entitlement', {
  headers: { Authorization: `Bearer ${storedToken}` },
}).then(r => r.json())

if (active) runExistingCalmEarAudioPipeline()
```

---

## Security

- Stripe secret key and webhook secret: server-only, never client-side
- Extension bearer tokens: stored as SHA-256 hashes (raw token sent once only)
- Pairing codes: SHA-256 stored, expire 10 minutes, single-use
- Every server endpoint verifies auth independently
- Extension identity resolved from token — never trusts client-provided userId
