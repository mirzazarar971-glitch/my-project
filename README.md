# DevTools Hub

DevTools Hub is a free, public developer workspace with 66 browser-local tools and a private, administrator-only analytics dashboard. Visitors need no account, login, subscription, or payment. Tool input is processed in the browser; it is not sent to the API. The IP Address Information tool is the only public tool that calls a third-party service: it sends the entered IP to ipapi.co and is labeled accordingly.

## Stack

- **Client:** React 19, Vite, TypeScript, Tailwind CSS, React Router, Zustand, Monaco Editor, Lucide, React Hot Toast
- **API:** Node.js, Express 5, Mongoose, MongoDB, Zod, bcrypt, admin-only JWT in an HttpOnly cookie
- **Tool processing:** Browser APIs plus Prettier, Terser, SQL Formatter, js-yaml, Ajv, QRCode, and UAParser

The Express API never evaluates user code. The JavaScript playground runs inside a sandboxed browser iframe with an opaque origin and a restrictive Content Security Policy.

## Requirements

- Node.js 20.19+ (latest LTS recommended) and npm
- MongoDB Community Server or MongoDB Atlas for anonymous analytics and administrator sign-in

All local browser tools work without MongoDB. Auth, favorites sync, usage analytics, and administration need a running database.

## Local setup (Windows PowerShell)

From the project root:

```powershell
npm install
npm install --prefix client
Copy-Item .env.example .env
```

Edit `.env` and set `MONGODB_URI` to your database and `JWT_SECRET` to a unique random value of at least 32 characters. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to provision the single administrator. The password must be at least 12 characters. On server startup, these values are synchronized to the administrator account; changing `ADMIN_PASSWORD` updates its stored bcrypt hash. For example, generate secrets in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

You can optionally set `ANALYTICS_HASH_SECRET` to a separate, stable random secret; otherwise analytics IDs are HMAC-hashed with a domain-separated key derived from `JWT_SECRET`. Do not rotate either key casually: doing so resets anonymous visitor continuity.

Start MongoDB, then run both apps:

```powershell
npm run dev
```

- Client: <http://localhost:5173>
- API health: <http://localhost:5000/api/health>

The Vite dev server proxies `/api` requests to port 5000. If `MONGODB_URI` is unset, the API still starts for health checks, while analytics and administrator sign-in return `503`; all public browser tools remain available. Public registration is disabled (`POST /api/auth/register` returns `410`). Only an administrator provisioned from server environment variables can sign in at `/admin`; no user-account or role-management UI is provided. If `ADMIN_EMAIL` changes, startup updates the existing admin record when there is exactly one, preserving its other data. It will not promote a non-admin account or guess which account to update if multiple admins exist.

## Analytics and privacy

The browser creates a random first-party visitor ID in local storage and a random session ID in session storage. The API HMAC-hashes both before storing them. Events contain route paths without query strings, tool slugs, execution outcome/duration, referrer host, campaign attribution, and coarse browser/device/OS labels. Raw IP addresses, full user-agent strings, tool inputs/outputs, passwords, and typed search terms are not stored. On-site search reports use only query length and result count.

Visible pages send a heartbeat every 25 seconds. “Active visitors” means distinct anonymous visitor IDs with a heartbeat during the configured active window; it is an estimate, not a live socket count. Session duration is estimated from first to last visible activity and capped at the inactivity timeout. Bounce rate is one-page sessions divided by completed sessions; a session is complete only after the configured inactivity timeout, and still-active sessions are excluded. These definitions are also shown in the dashboard.

Analytics event, session, and visitor documents expire using MongoDB TTL indexes. Defaults are 180 days of retention, a 30-minute session timeout, and a 60-second active window. Configure `ANALYTICS_RETENTION_DAYS` (30–730), `ANALYTICS_SESSION_TIMEOUT_MINUTES` (5–120), and `ANALYTICS_ACTIVE_WINDOW_SECONDS` (30–180) in `.env`.

Country reporting is disabled by default. To enable it, set `ANALYTICS_COUNTRY_HEADER` to `cf-ipcountry` or `x-vercel-ip-country` only when a trusted reverse proxy strips client-supplied copies and sets the header itself. The API does not perform IP geolocation or persist raw IP addresses.

## Google Search Console

The Search Analytics section uses the official Google Search Console API and shows no sample metrics when disconnected. To enable it:

1. Enable the Search Console API in a Google Cloud project and create an OAuth 2.0 web client.
2. Add the exact API callback URL `https://<api-host>/api/admin/search-console/callback` to the OAuth client's authorized redirect URIs.
3. Ensure the administrator's Google account has access to the Search Console property, then set `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REDIRECT_URI`, and `GSC_SITE_URL` in the API environment. The property can be a URL-prefix URL or a `sc-domain:` property.
4. Generate `GSC_TOKEN_ENCRYPTION_KEY` as a base64-encoded 32-byte key:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

5. Restart the API and select **Connect Google account** in Admin → Search analytics. Only the read-only `webmasters.readonly` scope is requested. Refresh tokens are encrypted with AES-256-GCM in MongoDB. Disconnecting removes the saved token.

Search Console data depends on Google's reporting delay and property permissions. A missing configuration, missing connection, or API error is shown as a status/error—not replaced with fabricated data.

## Tests and production build

```powershell
npm test
npm run build
npm start
```

The client unit tests cover representative processors and validation behavior. API tests cover public registration denial, admin route protection, analytics event validation, administrator-session exclusion, date filters, privacy-safe hashing, and traffic classification. End-to-end ingestion, aggregation, TTL cleanup, admin login, and Google OAuth require a configured MongoDB instance and, for Search Console, Google credentials.

## Production deployment

1. Provision MongoDB and restrict its network access to the API deployment. Confirm the deployment user can create indexes; the API initializes analytics indexes on startup.
2. Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (unique, 32+ characters), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (unique, 12+ characters), `CLIENT_ORIGIN` (the exact public frontend origin), `PORT`, and `VITE_SITE_URL` in the deployment environment. Optionally set `ANALYTICS_HASH_SECRET`, retention/session values, and `VITE_CONTACT_EMAIL`.
3. Build the client after setting `VITE_SITE_URL` so the generated sitemap and `robots.txt` use the canonical public origin:

   ```powershell
   npm ci
   npm ci --prefix client
   npm run build
   ```

4. Deploy `client/dist` to static hosting with SPA fallback routing to `index.html`. Deploy the Express API separately with `npm start`. Configure the frontend host to proxy `/api` to the API or set the client API base URL to a same-site proxy.
5. Use HTTPS in production. The administrator cookie is HttpOnly, SameSite Strict, and Secure in production. Keep `.env` and production secrets out of source control.
6. If enabling Search Console, also configure the Google OAuth variables and encryption key above; never put Google secrets in `VITE_*` variables.
7. Configure MongoDB backups, uptime monitoring, and an appropriate API rate limit for your traffic profile. TTL deletion is asynchronous and is performed by MongoDB's TTL monitor.

The deployment uses a cookie-based session; host the frontend and API on the same site (or use a same-site reverse proxy) so the browser sends the session cookie consistently. Update the CORS allowlist in `CLIENT_ORIGIN` when the frontend domain changes.

## Project layout

```text
client/
  src/
    context/       Administrator session state
    components/    Shared analytics tracking
    pages/         Private admin analytics dashboard
    services/      API client and first-party event queue
    state/         Local preferences and tool availability
    tools/         Tool catalog and browser-only processing engine
    App.tsx        Responsive shell, directory, and tool routes
server/
  config/          MongoDB connection and seed/bootstrap
  middleware/      Administrator authorization and database guards
  models/          Tool, administrator, event, visitor, session, and OAuth models
  routes/          Admin, public tool catalog, auth, and analytics ingestion APIs
  services/        Analytics aggregations and Google Search Console integration
  tests/           API tests
scripts/           Sitemap and robots.txt generation
```

## Privacy and security notes

- Favorites and recent tools are stored in browser local storage. Tool input/output is not persisted to local storage, the API, or analytics records.
- First-party visitor/session IDs are random; only server-keyed HMAC hashes are persisted.
- Analytics excludes signed administrator sessions. Public tool processing does not depend on authentication or database availability.
- The admin JWT is stored in an HttpOnly cookie rather than browser-accessible storage. Public registration and non-admin sign-in are disabled.
- Analytics stores only route paths (not query strings), referrer host, coarse audience labels, and UTM attribution. Raw IPs and typed search terms are not retained.
- Google refresh tokens are encrypted at rest; API credentials are server-only. Disconnecting Search Console deletes the saved credential.
- The IP lookup is the sole external API integration and discloses the requested address to ipapi.co.
- JWT Decoder only parses header and payload; it does not verify signatures or treat claims as trusted.
- User JavaScript executes only in a sandboxed browser iframe. No user-provided code execution endpoint exists on the server.
