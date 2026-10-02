# ZB CRM — Graphify Query Cheatsheet

A reference for getting the most out of your knowledge graph when working in
Cursor (Agent mode) or the terminal. Keep this open in a side tab while you
build.

The `.cursor/rules/graphify.mdc` file makes Cursor consult the graph
automatically for codebase questions, so most of the time you just ask
naturally. The prompts below are for situations where being explicit unlocks
better answers — refactors, audits, debugging, and onboarding back to code you
haven't touched in a while.

---

## The Three Commands You'll Use Most

These run in your terminal against the existing `graph.json`. No LLM calls.

```bash
graphify query "<question>"          # ask the graph anything structural
graphify path "<NodeA>" "<NodeB>"    # show how two things are connected
graphify explain "<Node>"            # describe a node and its neighborhood
```

Inside Cursor's AI chat (Agent mode), the same commands work as slash commands:

```
/graphify query "<question>"
/graphify path "<NodeA>" "<NodeB>"
/graphify explain "<Node>"
```

When you're not sure of a node name, start with `query` — it'll surface the
right node IDs you can then pass to `path` or `explain`.

---

## Project Queries by System

Copy-paste these against the systems you've actually built. Tweak the specifics
as your code evolves.

### Role & Permission System

```bash
graphify query "where does the attorney role get checked across the app?"
graphify query "every component or route guarded by an admin role check"
graphify query "what files reference the role column on the profiles table?"
graphify query "differences between Account Manager and Attorney access paths"
```

Use these before changing any role-based logic — they'll show you the full
surface area you might break.

### Sidebar Components

```bash
graphify explain "AdminSidebar"
graphify explain "AttorneySidebar"
graphify path "AdminSidebar" "AttorneySidebar"
graphify query "shared sidebar primitives used by both Admin and Attorney"
graphify query "where is the collapse toggle state managed?"
graphify query "every component that renders the user footer"
```

The `path` query is especially useful here — it'll show whether the two
sidebars share components or just look alike. If they share, refactors are
safer in one place. If they don't, you'll see the duplication.

### Shape Migration Pipeline

```bash
graphify explain "ShapeMigrationBot"
graphify query "all references to shape_lead_id across the codebase"
graphify query "where does the migration bot write to Supabase?"
graphify path "ShapeMigrationBot" "ClientNotesTable"
graphify query "deduplication logic in the Shape migration"
```

Run these before re-running the bot or modifying the matching logic — you'll
catch any downstream code that depends on the current matching behavior.

### Email Sequence System

```bash
graphify query "what triggers an email send in the codebase?"
graphify path "ResendDispatcher" "email_logs"
graphify query "every place sequence_enrollments is read or written"
graphify explain "EmailSequenceCronRoute"
graphify query "where is the bank holiday pause logic?"
graphify query "webhook handlers for delivery status updates"
```

The dispatcher cron, the webhook, and the admin UI for enrollments all touch
overlapping tables. The graph is the fastest way to see the full picture.

### Packet Manager / FedEx Resend

```bash
graphify query "fetchPacketsNeeded Resend via FedEx runPendingFedexBatch Pending"
graphify path "fetchPacketsNeeded" "runPendingFedexBatch"
graphify explain "fetchPacketsNeeded"
graphify query "every writer of client_fedex_shipments status Pending"
graphify query "where is fedex_declined checked for Packets Needed"
```

**Invariant:** Packets Needed UI (`fetchPacketsNeeded`) and batch send
(`runPendingFedexBatch`) must use the same eligibility rules. Explicit
**Resend via FedEx** inserts a `Pending` shipment marker; that marker must
re-queue the client even if they left `client_services` or have a prior
`fedex_declined`. Terminal stages live in `FEDEX_BATCH_EXCLUDED_STAGE_SET`
(`lib/postlogic/fedex-ready-filter.ts`). See
`.cursor/rules/packet-manager-resend.mdc`.

### Attorney Queue / Public Batch Downloads

```bash
graphify query "attorney batch queue public download token service_role"
graphify path "createAttorneyBatch" "loadPublicAttorneyBatch"
graphify explain "fetchAttorneyQueue"
graphify query "where is ATTORNEY_EMAIL_NOTIFICATIONS_ENABLED checked"
```

**Invariant:** Public `/attorney-batch/[token]` links stay no-login. Download
API must **stream** via service-role `storage.download()` with `no-store`
headers — never `fetch(signedUrl)` through Vercel and never rely on a
CDN-cached 302 to a signed URL (Jul 2026: "Could not fetch file" /
expired JWT). Queue lists all unbatched `case_sent_to_attorneys` clients
(manual moves included). See `.cursor/rules/attorney-queue-downloads.mdc`.

### Client Notes & Source Account

```bash
graphify query "what files touch the source_account column?"
graphify query "all readers and writers of client_notes"
graphify query "where is shape_note_id used in import logic?"
graphify explain "AdminImportPage"
graphify path "AdminImportPage" "client_notes"
```

Critical before you change the unique constraint or add new note sources —
catches anything that assumes the old `shape_note_id`-only uniqueness.

### Sentry / Seer / GitHub Pipeline

```bash
graphify query "where is Sentry initialized?"
graphify query "every Sentry capture call in the app"
graphify query "error boundaries and their connections to logging"
```

Less critical because most of this pipeline lives outside your repo, but
useful when tuning what gets captured and what triggers Seer.

### DocuSign Integration (paused)

DocuSign work is on hold while the printing company handles signature packets.
When you come back to it, these are the queries to start with:

```bash
graphify query "all references to DocuSign or envelope in the codebase"
graphify explain "DocuSignSendEnvelopeRoute"
graphify path "AccountManagerForm" "DocuSignWebhookHandler"
```

---

## Prompt Patterns by Task

### Before Refactoring

Always lead with a blast-radius query. Drop this into Cursor's AI chat before
asking for any structural change:

> Before suggesting any changes, query the graph for everything that depends
> on `<component or table or function>`. List every dependent, group them by
> file, and tell me which ones I'd need to update if I changed the
> signature/schema. Only after that, propose the refactor.

This single pattern prevents most "I missed a usage" follow-up fixes.

### Debugging a Regression

When something broke after a recent change:

> Something broke in the `<area>` flow after my last commit. Use the graph to
> identify everything connected to `<the thing you changed>` and walk through
> the most likely paths a regression could travel. Then check each path in the
> actual code.

### Returning to Old Code

When you haven't touched a system in a few weeks and need to remember how it
works:

> Run `/graphify explain <ComponentOrModule>` and walk me through the
> neighborhood. What does this depend on, what depends on it, and what's the
> typical control flow when this runs?

### Auditing for Inconsistency

When you suspect duplicate logic or drift between two areas:

> Compare the role-checking logic in Admin routes vs Attorney routes using the
> graph. Find places where the same concept is implemented twice or where the
> implementations have diverged. Flag anything suspicious.

### Planning a New Feature

When designing something new that has to slot into the existing system:

> I want to add `<feature>`. Use the graph to find the natural integration
> points — existing modules with similar responsibilities, tables this would
> need to touch, and components I could extend rather than create from scratch.
> Propose three placement options ranked by how well they fit the existing
> structure.

---

## Day-to-Day Maintenance

### Git Hook (already installed)

Every `git commit` auto-rebuilds the AST portion of the graph. Free, fast,
nothing to do.

### After Major Refactors or New Docs

When you've added new markdown files, PDFs, or done a structural refactor that
moved many files around, rebuild the semantic layer:

```bash
gupdate            # incremental — only changed files
gbuild             # full rebuild — when in doubt
```

Both use your Claude subscription via `--backend claude-cli`, so they cost
nothing. The git hook only handles code AST updates, not docs, so `gupdate`
is the way to refresh documentation extraction.

### When Cursor Feels Stale

If Cursor's answers feel like they're missing recent changes, the graph might
be out of date. Quick fix:

```bash
gupdate
```

Then restart Cursor (`⌘ Q` and reopen) so it re-reads the rule file and
re-loads the graph.

---

## When to Use the Graph vs Not

**Lean on the graph for:**

- "Where is X used?" — structural questions
- "What depends on Y?" — impact analysis
- "How does A connect to B?" — relationship questions
- "What's connected to this table/column?" — schema-aware queries
- "Show me everything in the auth flow" — system-level understanding

**Skip the graph for:**

- Live data questions ("what's actually in my Supabase right now?") — that's
  a Supabase query
- UI/UX decisions ("should this button be teal or navy?") — judgment call
- Single-line bug fixes — sometimes grep is fine
- Brand-new feature design from scratch — graph helps you fit *into* the
  existing system, not invent net-new architecture
- Anything about runtime behavior in production — that's Sentry's domain

---

## Quick Troubleshooting

### "Cursor doesn't seem to be using the graph"

Verify the rule file exists and you're in Agent mode:

```bash
ls -la .cursor/rules/graphify.mdc
```

If missing, reinstall: `graphify cursor install`. If present, restart Cursor.

### "Query returns nothing for something I know exists"

The node naming convention is `<filename_stem>_<entity>` in lowercase. Try
broader queries:

```bash
graphify query "<broader concept>"
```

Then narrow down using the returned node IDs.

### "Graph feels out of date"

```bash
gupdate
```

If you suspect deeper drift (renames, deletes, big refactors), force a full
rebuild:

```bash
gbuild --force
```

### "Need to start fresh"

Nuclear option — delete `graphify-out/` and rebuild:

```bash
rm -rf graphify-out/
gbuild
```

---

## One-Liner Mental Model

> Treat the graph as the project's structural memory. Ask it "what" and
> "where" questions; ask Cursor (using the graph) "how" and "why" questions.