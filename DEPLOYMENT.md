# Deployment Runbook — homecarehelp-backend

Target: a Linux VPS (Ubuntu/Debian assumed below). Single Node.js process managed by PM2 behind Nginx.

## 1. Server prerequisites

```bash
# Node.js 18+ (engines field enforces this)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Chromium for Puppeteer (partner agreement PDF generation) — much more
# reliable on a VPS than Puppeteer's bundled Chrome download.
sudo apt-get install -y chromium-browser

# PM2 process manager
sudo npm install -g pm2
```

## 2. Deploy the code

```bash
git clone <repo-url> homecarehelp-backend
cd homecarehelp-backend
cp .env.example .env
nano .env   # fill in real DATABASE_URL, JWT_SECRET, CASHFREE_*, PRATIMA_*, CORS_ORIGINS
```

In `.env`, set:
```
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

`env.js` will **refuse to start** in production if `JWT_SECRET`/`CASHFREE_CLIENT_ID`/`CASHFREE_CLIENT_SECRET`
are missing or still set to their placeholder values — this is intentional, fix the `.env` rather than
bypassing it.

## 3. Install dependencies & generate the Prisma client

```bash
npm install   # postinstall runs `prisma generate` automatically
```

The Prisma schema outputs the client to `./generated/prisma` with a Postgres driver adapter
(`@prisma/adapter-pg`) — this is required by Prisma 7's new query engine and is already wired up in
`src/common/prismaClient.js`. No extra steps needed beyond `npm install`.

## 4. Start with PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable PM2 on boot
```

`instances: 1` in `ecosystem.config.js` is deliberate — the partner e-sign RAM cache
(`partnerSessionStore.js`) and the daily cleanup cron are in-process/in-memory state. Running multiple
instances would split that state across processes and break both. If you need horizontal scaling
later, that RAM cache needs to move to Redis first.

## 5. Put Nginx in front (TLS + reverse proxy)

```nginx
server {
    listen 80;
    server_name api.homecarehelp.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `sudo certbot --nginx -d api.homecarehelp.in` for TLS.

`app.js` already has `app.set('trust proxy', 1)` so `req.ip` (used by the rate limiter) reflects the
real client IP instead of Nginx's.

## 6. Verify

```bash
curl https://api.homecarehelp.in/health
# {"status":"ok","db":"up","uptime":...}
```

If `db` comes back `"down"`, check `DATABASE_URL` and that the Postgres host allows the VPS's IP.

## 7. What runs automatically

- **Daily cleanup cron** (`src/common/jobs/cleanupJob.js`, midnight server time): removes partner
  e-sign sessions/temp PDF files older than 24h — i.e. partners who signed but never completed
  payment. Nothing to configure; logs a line to PM2's log only when it actually removes something.
- **Graceful shutdown**: `pm2 restart`/`pm2 stop`/`pm2 reload` send `SIGTERM`, which `server.js`
  catches to stop the cron, drain in-flight requests, and close the Postgres connection before
  exiting (10s hard-timeout fallback).

## 8. Redeploying

```bash
git pull
npm install        # re-runs prisma generate if the schema changed
pm2 restart homecarehelp-backend
```

## 9. Logs

```bash
pm2 logs homecarehelp-backend        # tail
pm2 logs homecarehelp-backend --lines 200
```

Morgan request logs and cron/error logs both go to PM2's combined log (`logs/out.log` / `logs/error.log`).

## 10. Known limitations to revisit later

- Single-instance only (see §4) — scale by moving the partner RAM cache to Redis before adding PM2 cluster mode.
- Admin module is a placeholder (`/api/admin/*` returns `501`) — no admin login/bookings-review/accept-reject exists yet.
- OTP login is not implemented — email/password only, by design for this pass.
