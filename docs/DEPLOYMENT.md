# Render deployment

The deployment screenshot shows a **Render** startup failure, not a Vercel build failure. The local `.env` is intentionally excluded from GitHub, so importing the repository does not supply database credentials or a session secret.

## Repair the existing Render web service

If logs show `listening on 127.0.0.1:3001` followed by a port-scan timeout, Render cannot reach the loopback-only listener. The latest code detects Render via its built-in `RENDER=true` variable and forces `0.0.0.0`, production frontend serving, and trusted HTTPS proxy handling even when local environment settings were copied. Copied localhost origins are replaced by Render's public URL. Keep custom HTTPS domains in `APP_ORIGIN` if applicable. Remove a manually copied `PORT=3001` to use Render's default port, or set `PORT=10000`; the app still honors any explicit valid port. Set `NODE_ENV=production` and `HOST=0.0.0.0` in the dashboard for clarity. Redeploy the latest commit on `main`; no secret changes or database reset are needed for this fix.

1. Select the `dha-bc` service. In **Settings**, use:
   - Runtime: Node
   - Build command: `npm ci --include=dev && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`
2. In **Environment**, use **Add from .env** and import the contents of the private `C:\dha-bc\.env.render` file. It contains your database connection and a newly generated deployment session secret. Do not add that file to GitHub or share its contents. If needed, regenerate the file from CMD using `node scripts/render-env.mjs` (existing deployment secret is retained).
3. Set `NODE_VERSION` to `22.19.0`. Render supplies `PORT` and `RENDER_EXTERNAL_URL`; do not copy the local port or localhost origin into the hosted environment. The server uses Render's external HTTPS URL automatically. Set `APP_ORIGIN` explicitly only for a custom domain, e.g. `https://office.example.com`.
4. Attach a persistent disk mounted at `/var/data/building-control`, matching `STORAGE_DIR`. Render persistent disks require a paid service. Only files under the disk mount survive deployments. Do not use the free service's temporary filesystem for real application documents.
5. Deploy the latest GitHub commit. Do not run `start.cmd` or `npm run dev` on Render.

The complete React frontend and Express API run on **one Render web service and one origin**. Production serves the frontend from `dist`; it does not use the Vite development server. The API binds to `0.0.0.0` and Render's assigned port. Secure cookies work behind Render's HTTPS proxy. There is no need to weaken authentication or commit a secret to fix startup.

The supplied Neon database was already migrated and contains the administrator account. Reusing that database reuses its accounts and records; do not reset the administrator merely to deploy. Local file uploads are not in GitHub or Neon: if existing document metadata references files on your PC, copy those files securely into the hosted persistent disk before using those documents online.

For a new empty database, review its schema and run `npm run db:migrate` before expecting the health check to pass; create its administrator using the documented setup process. Migrations are intentionally not run automatically during every deployment.

## New Render service through a Blueprint

The repository now includes `render.yaml`. Select **New → Blueprint** and connect this repository. Render asks for `DATABASE_URL`, generates a random session secret, and defines the required persistent disk and production settings. This blueprint declares a paid Starter service; review the displayed costs before creating it. Importing `render.yaml` is not necessary to repair the existing manually created web service, and adding the file does not automatically update that service's environment settings.

## Vercel

Do not deploy this repository as a standalone Vite static site and expect the API to work. The frontend calls `/api` on the same origin. A static-only deployment has no running Express API.

The current document implementation also requires persistent filesystem storage. A full Vercel deployment needs a serverless-compatible API entry point and private object storage (with upload handling appropriate to function request limits), or a separately hosted backend and a carefully configured same-origin proxy. Those adaptations are **not included in this Render repair**. Use the full-stack Render service for the current implementation. No Vercel deployment has been attempted or verified.

## Verification after deploy

- `/api/status` returns the application identity without requiring database access.
- `/api/health` returns `{"ok":true}` when the configured PostgreSQL schema is reachable.
- The homepage displays the login screen, and login works through HTTPS.
- Upload a test document and confirm it remains available after a redeploy.

Do not treat a successful build or `/api/status` response alone as proof that the database and persistent disk are configured.

References: https://render.com/docs/web-services, https://render.com/docs/configure-environment-variables, https://render.com/docs/blueprint-spec, https://render.com/docs/disks, https://vercel.com/docs/frameworks/backend/express.
