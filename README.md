# DevTools Hub

DevTools Hub is a responsive, dark-first developer workspace with 66 dedicated browser-local tools for text, JSON, HTML/CSS/JavaScript, encoding, utilities, and programming. Tool input is processed in the browser; it is not sent to the API. The only tool that calls a third-party service is IP Address Information, which sends the entered IP to ipapi.co and is labeled accordingly.

## Stack

- **Client:** React 19, Vite, TypeScript, Tailwind CSS, React Router, Zustand, Monaco Editor, Lucide, React Hot Toast
- **API:** Node.js, Express 5, Mongoose, MongoDB, Zod, bcrypt, JWT in an HttpOnly cookie
- **Tool processing:** Browser APIs plus Prettier, Terser, SQL Formatter, js-yaml, Ajv, QRCode, and UAParser

The Express API never evaluates user code. The JavaScript playground runs inside a sandboxed browser iframe with an opaque origin and a restrictive Content Security Policy.

## Requirements

- Node.js 20.19+ (latest LTS recommended) and npm
- MongoDB Community Server or a MongoDB Atlas connection for accounts, activity analytics, and admin features

All local browser tools work without MongoDB. Auth, favorites sync, usage analytics, and administration need a running database.

## Local setup (Windows PowerShell)

From the project root:

```powershell
npm install
npm install --prefix client
Copy-Item .env.example .env
```

Edit `.env` and set `MONGODB_URI` to your database and `JWT_SECRET` to a unique random value of at least 32 characters. For example, generate a secret in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Start MongoDB, then run both apps:

```powershell
npm run dev
```

- Client: <http://localhost:5173>
- API health: <http://localhost:5000/api/health>

The Vite dev server proxies `/api` requests to port 5000. If `MONGODB_URI` is unset, the API still starts for health checks, while database-backed endpoints return `503`; local browser tools remain available.

## Admin account

To create an initial admin account, set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first server start with that email. The password must be at least 12 characters. The bootstrap process creates the account only if that email is unused; it never changes an existing account's role or password. Admins can promote other accounts from `/admin`.

## Tests and production build

```powershell
npm test
npm run build
npm start
```

The client unit tests cover representative processors and validation behavior. API tests cover health, security headers, CORS, and database-unavailable responses. Authentication, admin workflows, and MongoDB persistence require a configured MongoDB instance for end-to-end testing.

## Production deployment

1. Provision MongoDB and restrict its network access to the API deployment.
2. Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (unique, 32+ characters), `CLIENT_ORIGIN` (the exact public frontend origin), `PORT`, and `VITE_SITE_URL` in the deployment environment. Optionally set `VITE_CONTACT_EMAIL` to a public support inbox; the Contact Us form opens the visitor's default email app and does not send or store messages on the server.
3. Build the client after setting `VITE_SITE_URL` so the generated sitemap and `robots.txt` use the canonical public origin:

   ```powershell
   npm ci
   npm ci --prefix client
   npm run build
   ```

4. Deploy `client/dist` to static hosting with SPA fallback routing to `index.html`. Deploy the Express API separately with `npm start`. Configure the frontend host to proxy `/api` to the API or set the client API base URL to a same-site proxy.
5. Use HTTPS in production. The session cookie is HttpOnly, SameSite Strict, and Secure in production. Keep `.env` and production secrets out of source control.
6. Configure MongoDB backups, uptime monitoring, and an appropriate API rate limit for your traffic profile.

The deployment uses a cookie-based session; host the frontend and API on the same site (or use a same-site reverse proxy) so the browser sends the session cookie consistently. Update the CORS allowlist in `CLIENT_ORIGIN` when the frontend domain changes.

## Project layout

```text
client/
  src/
    context/       Authentication state
    services/      API client
    state/         Local preferences and tool availability
    tools/         Tool catalog and browser-only processing engine
    App.tsx        Responsive shell, directory, and tool routes
server/
  config/          MongoDB connection and seed/bootstrap
  middleware/      Authentication, roles, and database guards
  models/          User, Tool, and privacy-safe Activity models
  routes/          Authentication, tool usage, and admin APIs
  tests/           API tests
scripts/           Sitemap and robots.txt generation
```

## Privacy and security notes

- Favorites and recent tools for guests are stored in browser local storage. Tool input/output is not persisted to local storage, the API, or activity records.
- Authenticated activity records contain only a user reference, tool reference, action, and timestamp.
- JWTs are stored in an HttpOnly cookie rather than browser-accessible storage.
- The IP lookup is the sole external API integration and discloses the requested address to ipapi.co.
- JWT Decoder only parses header and payload; it does not verify signatures or treat claims as trusted.
- User JavaScript executes only in a sandboxed browser iframe. No user-provided code execution endpoint exists on the server.
