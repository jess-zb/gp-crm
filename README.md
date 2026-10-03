# Golden Pathway CRM

Case management for Golden Pathway. Staff take a client from intake through Account Manager, Client Services, and attorney hand-off. E-sign lives in the CRM. A MID is a label on the client, and it chooses which e-sign documents that client sees.

## Stack

- Next.js 14 (App Router), TypeScript, and Tailwind CSS
- Local Postgres, Auth, Storage, and row-level security through the Supabase CLI
- Email through Resend when `RESEND_API_KEY` is set
- In-CRM e-sign

## Run it locally

```bash
pnpm install
cp .env.example .env.local
supabase start
```

`supabase start` serves the API on port 55321 and Postgres on port 55322. Copy the local API URL, anon key, and service role key from `supabase status` into `.env.local`. Leave that file untracked.

Address autocomplete on the client form uses HERE Maps. Set `NEXT_PUBLIC_HERE_KEY` in `.env.local`, then restart the dev server. The key stays out of the repo.

```bash
pnpm exec next dev --hostname 127.0.0.1 --port 43123
```

Open [http://127.0.0.1:43123/login](http://127.0.0.1:43123/login).

Create staff in local Auth, then set `profiles.role`. `admin` manages MIDs and the Knowledge Base. `dev` is hidden from other staff. `acct_manager` works the client list and can read the Knowledge Base.

## Checks

```bash
pnpm tsc --noEmit
pnpm check:business-contact
```
