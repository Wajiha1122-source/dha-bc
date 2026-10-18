# DHA Multan — Building Control Management

Internal application for **Site Plan / Possession Letter**. React/TypeScript/Vite/Tailwind client; Express/TypeScript API; PostgreSQL records and sessions; private filesystem documents.

**Hosting on Render:** see [deployment instructions](docs/DEPLOYMENT.md) and `render.yaml`. GitHub excludes `.env`; configure hosting secrets separately. The current full-stack application is not a standalone Vercel static site.

## Start from Command Prompt (CMD)

The application runs with Node.js. PowerShell is not required.

```bat
cd /d C:\dha-bc
start.cmd
```

Open **http://localhost:5173**. Keep CMD open while using the application; press Ctrl+C to stop it. The local database connection and session secret are already configured. Administrator credentials are supplied separately, with a required password change on first login. You can also run `npm run dev` directly from CMD. If the app is already running on port 5173, use that instance or stop it before starting another one; the launcher will not silently choose another URL.

The launcher checks the frontend and API separately, reuses recognized running services, and starts only missing services. It prints `Ready` only after checking the page and its API proxy. A slow database does not cause a duplicate frontend to be started. If another program occupies either port, the launcher identifies the conflict without terminating that program. Keep the original terminal open when reusing an existing service.

## Database inspection and initialization

The supplied attachment contained a connection string, not a SQL script. A read-only inspection succeeded on 18 October 2026 and returned **no user tables**. The application therefore introduces an isolated `bc` schema. Migration `database/001_initial.sql` was applied to the supplied database. No existing business tables were replaced. No demonstration applications are seeded.

The schema contains roles, staff, sessions, process definitions and configuration versions, applications, document metadata, scrutiny decisions, workflow movements, handovers, notifications, and append-only audit records. Application numbers use a concurrency-safe sequence; `BC` is a configurable example prefix, not an asserted official numbering convention. The sequence does not reset annually.

The migration refuses to adopt a pre-existing `bc` schema without its migration ownership table. It uses a transaction and advisory lock, and is repeatable. Before using another database, inspect its schema and map existing tables rather than applying this migration blindly.

## Run locally

Prerequisites: Node.js 22.19 or newer supported LTS, npm, and PostgreSQL 15+ with TLS for remote connections.

```powershell
cd C:\dha-bc
npm ci
# For another installation: copy .env.example to .env and fill in the placeholders.
npm run db:inspect
npm run db:migrate
npm run setup:admin
npm run dev
```

Open **http://localhost:5173**. The API listens on `127.0.0.1:3001`; Vite proxies `/api`. Keep `APP_ORIGIN` exactly equal to the browser origin. Use `localhost`, rather than `127.0.0.1`, for the frontend URL with the supplied settings.

This workspace has an ignored local `.env` with the supplied connection and a freshly generated session secret. `.env.example` contains placeholders only. Neither credentials nor database URLs belong in source control. Restrict filesystem access to `.env` and the private storage directory. Rotate the supplied database credential through the database administrator before operational deployment because it was shared in the request.

## Initial administrator credentials

**This workspace's administrator is already provisioned; use the latest credentials supplied with the handoff.** For a fresh installation, run `setup-admin.cmd` from CMD. The script generates a username such as `admin.<random suffix>` and a cryptographically random temporary password. It creates the account once, stores only an Argon2id hash, and displays the credentials once in that terminal. Save them directly into the approved password manager, then press Enter to clear the display.

No plaintext administrator password is saved in source files or this README. PowerShell and separate setup windows are not needed to use this workspace. First login requires replacing the temporary password. The latest issued credentials supersede those displayed in any earlier setup windows; those windows can be closed. Fresh-install setup cannot overwrite an existing administrator.

An administrator can create staff in **Team members**, give a temporary password through an approved channel, change roles, and deactivate accounts. Deactivation and role changes revoke existing sessions. The last active administrator is protected. Password reset for a lost administrator account requires a controlled DBA recovery procedure; there is no public reset endpoint.

## Daily workflow

1. Register an application, owner availability, property details, and optional assignee. The reference is generated on the server.
2. Upload the checklist documents on its detail page and record Received, Verified, Missing or Invalid with remarks. The fifth item is **Copy of Paid Challan**. The sixth is required only if the owner is unavailable. The fourth remains a distinct requirement.
3. Move to Document Scrutiny. Forwarding into processing and approval requires every applicable mandatory item to be verified. Uploading a replacement automatically resets that item's verification to Received.
4. The officer approves, rejects with a reason, or returns with a reason. Returned cases can receive replacement documents and re-enter scrutiny. Approval does not complete a case.
5. Start Final Document Preparation, upload the final document, then mark Ready for Counter.
6. Counter staff upload a scanned signed acknowledgement, verify identity/authorization under office policy, select the final document, and record delivered/retained copies. Confirm handover to complete the case. Duplicate handover is rejected transactionally.

Application receipts and handover records print from the detail page. Report printing supports browser **Save as PDF**; CSV opens in Excel. A scanned signature is an acknowledgement, not a certified digital signature.

## Access and configuration

Seven initial roles are configured. Registration, scrutiny, processing, approval, preparation, handover, reporting, audit, and administration are separate permissions. Requests enforce permissions on the API; hiding navigation is not the security boundary.

Without `view_all`, staff can access applications they created or are assigned. Officers with approval permission also see the pending-approval queue; staff with handover permission see ready/completed cases. Supervisors and auditors have read access to all records by default. Administrators can change permission sets in settings. Queue scope and permissions should be reviewed against DHA policy before use.

Process settings are versioned JSON with server validation. Existing cases retain a snapshot so changes do not silently rewrite their requirements or workflow. Defaults are configurable targets, not confirmed office SLAs. Overdue means elapsed calendar days since submission exceed the configured target; reports separately measure time in recorded client-correction intervals. No official fee or additional mandatory document is invented.

Future process records can share the engine and define requirements, fields, routes, output labels, and targets. Only the initial process is enabled. A friendly multi-process configuration designer and richer condition/routing rules remain future work; the current editor is intended for trained administrators. Counter identity and signature handling deliberately follow the implemented scanned-acknowledgement mechanism. Output documents are uploaded, not automatically generated from an official DHA template.

## Security and deployment

- Argon2id passwords, PostgreSQL-backed server sessions, HttpOnly/SameSite cookies, 30-minute rolling idle expiry and 8-hour absolute expiry.
- Origin checks plus a session-bound CSRF token on writes, login and request rate limits, Helmet security headers, safe error responses, parameterized SQL and Zod validation.
- Files limited to 10 MB; PDF/JPEG/PNG/WebP content signatures checked. Files have random storage names, remain outside public assets, and require authorization for every preview/download. Prior versions are retained. No public file URLs.
- Application-row locking for mutations, transactionally recorded audit and movements, unique handover constraints, and database triggers preventing update/delete of history tables.
- CSV formula neutralization and a bounded report export (5,000 records per query). Narrow date filters for larger registers.

Do not publish this service to a public cloud without DHA IT authorization. Bind the API to loopback behind an IT-managed HTTPS reverse proxy. Build with `npm run build`, then set `NODE_ENV=production`, `APP_ORIGIN=https://approved-internal-host`, and `PORT=3001`; run `npm start` under an OS service manager. Set `TRUST_PROXY=1` only when exactly one trusted proxy terminates HTTPS. Production cookies require HTTPS. Proxy `/` to the API, which serves `dist` in production. Cap uploads at the proxy (allow multipart overhead above 10 MB), protect logs, and apply network allowlists.

Use a dedicated runtime database role with only required privileges on `bc` tables/sequences. Use a separate migration owner; do not deploy using a database owner credential. Restrict updates on document metadata to superseding versions and do not grant runtime schema ownership or trigger-alteration rights. Database-owner users can bypass triggers; audit integrity also depends on database administration and backups.

Before production acceptance: approve identity/handover policy, numbering and SLAs; review role scope; configure malware scanning/quarantine for uploads; confirm retention rules; conduct load, accessibility and penetration testing. File signature checks are not malware scanning. Filesystem and database writes cannot be one atomic transaction; failed uploads are removed, but process crashes can leave harmless orphan files requiring reconciliation. Do not delete files merely because a temporary database outage makes them appear unreferenced.

## Verification

```powershell
npm run build
npm test
# To include real PostgreSQL HTTP integration tests:
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npm test
```

Without `TEST_DATABASE_URL`, the real-database suite is explicitly skipped. Set that variable through an approved secret mechanism; do not paste credentials into recorded shell history. The integration suite creates a unique `bc_test_<random>` schema, exercises the actual API and PostgreSQL transactions, then drops only that schema and deletes its temporary files. The database role needs schema creation privileges. It never inserts sample cases into `bc`.

Verified on 18 October 2026: production build and TypeScript check passed; all **15 tests passed**, including the real-PostgreSQL HTTP integration suite. The suite covers conditional checklist rules, permission denial, forced password change, CSRF, document replacement and verification invalidation, required approval stages, final-document gating, handover validation, duplicate completion, reporting, search, and append-only history. Browser automation timed out, so visual browser acceptance remains unverified. These checks do not replace staff acceptance testing or a production security assessment.

## Backup and restore

Use PostgreSQL tools with an approved password file/service definition, rather than passwords on the command line. Schedule encrypted database backups and matching private-storage snapshots. Back up **all `bc` tables and sequences**, plus document files and securely managed deployment secrets. Restrict backups as tightly as operational records.

Example commands using an IT-configured PostgreSQL service:

```text
pg_dump --dbname=service=building_control --format=custom --schema=bc --file=building-control.dump
pg_restore --dbname=service=building_control_restore --no-owner building-control.dump
```

Restore into a separate empty database first, restore the corresponding document directory, update the private environment, verify file access and row counts, invalidate restored sessions, and test the full workflow before switching traffic. Record backup identifiers and test restoration regularly. Do not use destructive `--clean` restore against an operational database without an approved recovery plan.

## Troubleshooting

- **Database connection failed:** verify DNS, TLS, allowlists, credential validity, and database availability. `npm run db:inspect` reports a sanitized code. Initial connections may need a retry after a suspended database wakes.
- **No enabled process / missing relation:** run the reviewed migration against the intended database. The migration does not seed cases or users.
- **CSRF/origin error:** use the exact `APP_ORIGIN` and refresh the page. Do not disable the checks.
- **Cannot log in after production setup:** confirm the reverse proxy sends HTTPS information and trusted-proxy configuration matches deployment.
- **Missing files after restore:** restore the storage snapshot matching the database backup. The app will not pretend a missing file downloaded successfully.
- **Wrong account access:** review role permissions, creator, assignment and queue state. Grant `view_all` only where office policy allows it.

## Project layout

```text
client/               React screens, reusable controls, API client, responsive styles
server/auth.ts        Sign-in, password change, session lifecycle
server/db.ts          Pool, transactions, permissions, record scope, audit helper
server/workflow.ts    Initial process and workflow business rules
server/validation.ts  Server-side input/configuration validation
server/applications.ts Registration, scrutiny, transitions, assignment, handover
server/documents.ts   Authorized private upload, versioning, preview and download
server/reports.ts     Actual-record dashboard, reports and CSV
server/administration.ts Staff, settings, notifications and audit access
database/             Versioned SQL migration
scripts/              Schema inspection/migration and secure administrator bootstrap
tests/                Business-rule and disposable-schema HTTP integration tests
```
