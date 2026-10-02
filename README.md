# Zero Balance CRM

Custom case management system for Zero Balance, LLC — debt invalidation and verification services.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database + Auth**: Hosted Postgres with authenticated API access
- **Hosting**: Your chosen Node-compatible host
- **Integrations**: DocuSign, FedEx, RingCentral

---

## First-Time Setup

### 1. Database

1. Open your project's SQL workspace
2. Apply the baseline schema SQL from the `supabase/` folder
3. Create a private storage bucket named `client-documents`
4. Copy the project URL and anon key from your provider dashboard

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your keys from each service.

### 3. Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Create your first admin user

1. Add a user through your auth provider's dashboard
2. Then run SQL similar to:
   ```sql
   UPDATE profiles SET role = 'admin', full_name = 'Your Name' WHERE email = 'your@email.com';
   ```
3. Log in at `localhost:3000/login`

---

## Deploy

```bash
npm run build
```

Configure production environment variables on your host, including `NEXT_PUBLIC_APP_URL` pointing at your live site URL.

### Database migrations

Production deploys run migrations before building, so schema changes ship with
the code that needs them. `vercel.json` sets the build command to
`npm run vercel-build`, which is `node scripts/migrate.mjs && next build`. If a
migration fails the build fails, and the previous deployment keeps serving.

`DATABASE_URL` must be set in the Production environment (Supabase **session**
pooler URI, port 5432 — the transaction pooler on 6543 does not support the
advisory lock or the DDL transactions this uses). A production build with no
`DATABASE_URL` fails on purpose rather than shipping code whose tables do not
exist.

Applied migrations are recorded in `supabase_migrations.schema_migrations`, the
same ledger the Supabase CLI uses.

```bash
npm run migrate:dry-run   # list what would be applied
npm run migrate           # apply pending migrations
```

#### One-time step before the first deploy that runs the runner

Migrations up to this point were applied by hand in the SQL editor, so the
ledger records only a handful of them. Left alone, the first run would treat
roughly 80 historical migrations as pending and re-run them — including a
`sequence_enrollments.next_send_at` rewrite that would reschedule every active
drip email, and a legacy contact scrub. Record them as already applied first:

```bash
DATABASE_URL="<production session pooler URI>" \
  npm run migrate:baseline -- --until=20260805210000
```

`--baseline` only inserts ledger rows; it runs no SQL from the files. Confirm
with `npm run migrate:dry-run` that the only pending versions left are the ones
you actually intend to ship, then deploy.

Baselining leaves production as it is today, which includes a few indexes and
functions the migration history describes but the live database never got.
`scripts/audit-migration-baseline.mjs` lists them.

Preview deploys skip migrations, because every environment shares the one
production database. Override with `MIGRATE_ALLOW_NON_PRODUCTION=1`. To unblock a
deploy without applying migrations, set `MIGRATE_SKIP=1` — then unset it.

Two constraints on migration files:

- Each runs in a single transaction, so avoid `CREATE INDEX CONCURRENTLY`.
- Filenames must be `<version>_<name>.sql` with a unique version; the ledger is
  keyed on version, so duplicates cannot both be recorded.

`scripts/audit-migration-baseline.mjs` compares every migration's tables,
columns, indexes, functions, and triggers against the live database, which is
useful for spotting drift.

---

## Webhook Setup (after deploying)

### DocuSign

1. Go to DocuSign Admin → **Connect → Add Configuration**
2. URL: `https://your-app.example.com/api/docusign/webhook`
3. Trigger on: Envelope Completed, Envelope Sent, Envelope Declined
4. Format: JSON

### RingCentral

1. Go to RingCentral Developer Console → **Webhooks**
2. URL: `https://your-app.example.com/api/ringcentral/webhook`
3. Subscribe to: SMS events, Call completion events

---

## User Roles

| Role | Access |
|------|--------|
| `admin` | Full access to everything |
| `management` | All clients, reports, team oversight |
| `team` | Assigned clients only |
| `attorney` | Read-only case packages for their assigned cases |
| `client` | Own file only via client portal |

## Pipeline Stages

1. **Lead** — initial intake
2. **Compliance Verification** — collecting ID, client information, recordings
3. **Account Manager** — follow up appointments and adding to FedEx list
4. **Client Services** — assigned CSR, agreement signed
5. **Awaiting Collection Letter** — client uploads evidence
6. **Case Sent to Attorneys** — auto-triggered on collection letter upload
7. **Closed** — archived

---

## Key Automation

When a client or team member uploads a document and marks it as a **collection letter**, the database trigger automatically:

1. Advances the client to stage 6 (Case Sent to Attorneys)
2. Records the timestamp
3. Creates an audit log entry
4. Notifies the attorney via email (configure a webhook or email provider)

## Security Notes

- SSNs are stored encrypted via `pgcrypto` — never stored in plaintext
- Card numbers are never stored — only creditor name, card type, and last 4 digits
- All storage buckets are private — files accessed via signed URLs only
- Access control enforces permissions at the database level regardless of app logic
- Full audit trail on every status change
