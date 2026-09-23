# Deploying CalmEar to Fly.io

Production target: **https://calmear-app.com**

Pipeline: GitHub → Docker image (built by Fly from `Dockerfile`) → Fly.io → `calmear-app.com`.

> **Naming:** every environment variable uses its `NUXT_` name — the exact same
> names in local development (`.env`) and in production (Fly secrets). These are
> the names Nuxt's runtime config resolves at runtime, so no mapping is needed.

---

## 1. Prerequisites

- [flyctl](https://fly.io/docs/flyctl/install/) installed, logged in: `fly auth login`
- Docker running locally (for local verification)
- All commands below run from `apps/web/` (where `Dockerfile` and `fly.toml` live)

## 2. Build locally

```bash
cd apps/web
docker build -t calmear-web .
```

No build arguments or secrets are required — the image contains no credentials.

## 3. Run the production image locally

```bash
docker run --rm -p 8080:8080 --env-file .env calmear-web
```

This works directly with your dev `.env` — the variable names are identical in
development and production.

Verify:

```bash
curl http://localhost:8080/api/health   # {"status":"ok",...}
curl http://localhost:8080/             # SSR HTML
```

## 4. Create the Fly.io app

```bash
cd apps/web
fly apps create calmear-app        # if the name is taken, pick another and update "app" in fly.toml
```

The region is `fra` (Frankfurt) — close to the Supabase `eu-central-1` database.
Change `primary_region` in `fly.toml` if your users are elsewhere.

## 5. Set Fly secrets

```bash
fly secrets set \
  NUXT_PUBLIC_APP_URL="https://calmear-app.com" \
  NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..." \
  NUXT_CLERK_SECRET_KEY="sk_live_..." \
  NUXT_DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  NUXT_STRIPE_SECRET_KEY="sk_live_..." \
  NUXT_STRIPE_WEBHOOK_SECRET="whsec_..." \
  NUXT_STRIPE_MONTHLY_PRICE_ID="price_..." \
  NUXT_STRIPE_YEARLY_PRICE_ID="price_..."
```

| Secret | Source |
|---|---|
| `NUXT_PUBLIC_APP_URL` | `https://calmear-app.com` (used for Stripe redirect URLs) |
| `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → **Production** instance → API keys (`pk_live_`) |
| `NUXT_CLERK_SECRET_KEY` | Clerk dashboard → **Production** instance → API keys (`sk_live_`) |
| `NUXT_DATABASE_URL` | Supabase → Settings → Database → **Transaction** pooler (port 6543) |
| `NUXT_STRIPE_SECRET_KEY` | Stripe dashboard (Live mode) → Developers → API keys (`sk_live_`) |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Stripe (Live mode) → webhook endpoint created in step 9 (`whsec_`) |
| `NUXT_STRIPE_MONTHLY_PRICE_ID` / `NUXT_STRIPE_YEARLY_PRICE_ID` | Stripe (Live mode) → CalmEar Premium product prices (`price_`) |

Setting secrets triggers a redeploy automatically.

## 6. Deploy

```bash
cd apps/web
fly deploy
```

Check:

```bash
fly status
curl https://calmear-app.fly.dev/api/health
```

## 7. Configure the domain `calmear-app.com`

```bash
fly certs add calmear-app.com
fly certs add www.calmear-app.com
fly ips list        # note your app's IPv4 and IPv6 addresses
```

Create these DNS records at your registrar:

| Type  | Name  | Value                          |
|-------|-------|--------------------------------|
| A     | `@`   | the IPv4 from `fly ips list`   |
| AAAA  | `@`   | the IPv6 from `fly ips list`   |
| CNAME | `www` | `calmear-app.fly.dev`          |

After DNS propagates, verify certificates:

```bash
fly certs show calmear-app.com
```

Fly issues TLS certificates automatically (Let's Encrypt). HTTP to HTTPS
redirect is enforced by `force_https` in `fly.toml`.

## 8. Configure Clerk (Production instance)

Clerk dev keys (`pk_test_`/`sk_test_`) only work on localhost — production
needs the **Production instance**:

1. Clerk dashboard -> top-left instance switcher -> **Production**
2. Confirm **Google** and **Email** providers are enabled on the production instance
3. **Domains**: ensure the production instance is configured for `calmear-app.com`
4. Paths: sign-in/sign-up redirect URLs -> `/dashboard` (matches `nuxt.config.ts`)
5. Copy `pk_live_` / `sk_live_` into the Fly secrets above

## 9. Configure Stripe (Live mode)

1. Stripe dashboard -> toggle **Live mode**
2. Create/recreate the **CalmEar Premium** product in live mode with the same
   recurring prices (4.99/mo, 39.99/yr) -> copy the live `price_` IDs
3. Activate the Customer Portal in live mode
4. Developers -> Webhooks -> **Add endpoint**:
   - URL: `https://calmear-app.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.paid`, `invoice.payment_failed`
5. Copy the endpoint's signing secret (`whsec_`) -> `NUXT_STRIPE_WEBHOOK_SECRET`

## 10. Database (Supabase)

Use your production Supabase project's **Transaction pooler** URL (port 6543)
for `NUXT_DATABASE_URL`. Run migrations from your machine against the
production DB:

```bash
cd apps/web
NUXT_DATABASE_URL="<production pooler URL>" npm run db:migrate
```

## 11. Logs & status

```bash
fly status            # machine state
fly logs              # live application logs
fly ssh console       # shell into the machine (debugging)
fly machine list
```

Health check: `GET /api/health` (also configured in `fly.toml`).

## 12. Rolling back

```bash
fly rollbacks list -a calmear-app      # list previous deploys
fly rollbacks back -a calmear-app      # roll back to the previous release
# or target a specific version:
fly rollbacks back <version> -a calmear-app
```

---

## Development is unchanged

`npm run dev` still uses `apps/web/.env` with the dev Clerk instance, Stripe
test keys, and the dev database. Nothing in this deployment setup affects
local development.
