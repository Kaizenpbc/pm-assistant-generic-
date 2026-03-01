# PM Assistant - Deployment Guide

## Overview

PM Assistant is deployed on TMD Hosting (cPanel) with LiteSpeed serving static files and Node.js (via CloudLinux Passenger) running the Fastify API server.

- **Domain:** https://pm.kpbc.ca
- **Server IP:** 69.72.136.201
- **SSH access:** `ssh kaizenmo@69.72.136.201`
- **App root on server:** `/home/kaizenmo/pm.ca`

## Tech Stack

- **Backend:** Fastify + TypeScript (Node.js 22)
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Database:** MariaDB
- **Web Server:** LiteSpeed (static files) + Passenger (Node.js)
- **AI:** Anthropic Claude SDK (optional, controlled by `AI_ENABLED` env var)

## Server Layout

```
/home/kaizenmo/pm.ca/
  ├── dist/server/              # Compiled server (Fastify)
  │   └── index.js              # Startup file
  ├── src/client/dist/          # Compiled client (Vite output)
  ├── index.html                # Served by LiteSpeed (copied from client dist)
  ├── assets/                   # Served by LiteSpeed (copied from client dist)
  ├── node_modules/             # Production dependencies
  ├── package.json
  └── .env                      # Environment variables
```

LiteSpeed serves static files (index.html, assets/) directly from `/home/kaizenmo/pm.ca/`. API requests are proxied to the Fastify server via Passenger.

## Node.js Environment

Node.js v22 is managed via the CloudLinux Node.js selector in cPanel.

- **Startup file:** `dist/server/index.js`
- **Virtual environment activation:**
  ```bash
  source /home/kaizenmo/nodevenv/pm.ca/22/bin/activate
  ```

## Environment Variables

The `.env` file on the server contains:

```
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=3306
DB_USER=kaizenmo_pmuser
DB_PASSWORD=<PASSWORD>
DB_NAME=kaizenmo_pmassist
JWT_SECRET=<SECRET>
JWT_REFRESH_SECRET=<SECRET>
COOKIE_SECRET=<SECRET>
CORS_ORIGIN=http://pm.kpbc.ca
LOG_LEVEL=info
AI_ENABLED=false
```

**Note:** Replace `<PASSWORD>` and `<SECRET>` placeholders with actual values. Never commit real secrets to version control.

## Deployment Steps

### 1. Build Locally

```bash
npm run build
```

This runs both the server build (TypeScript via `tsc`) and the client build (Vite).

### 2. Upload Server Files

```bash
scp -r dist/server/* kaizenmo@69.72.136.201:/home/kaizenmo/pm.ca/dist/server/
```

### 3. Upload Client Files

```bash
scp -r src/client/dist/* kaizenmo@69.72.136.201:/home/kaizenmo/pm.ca/src/client/dist/
```

### 4. Copy Client Files to Document Root

LiteSpeed serves static files from the app root, so the client build output must be copied there:

```bash
ssh kaizenmo@69.72.136.201 "cp -r /home/kaizenmo/pm.ca/src/client/dist/* /home/kaizenmo/pm.ca/"
```

### 5. Restart the Application

```bash
ssh kaizenmo@69.72.136.201 "cloudlinux-selector restart --json --interpreter nodejs --domain pm.kpbc.ca --app-root pm.ca"
```

### Quick Deploy (All Steps)

```bash
npm run build && \
scp -r dist/server/* kaizenmo@69.72.136.201:/home/kaizenmo/pm.ca/dist/server/ && \
scp -r src/client/dist/* kaizenmo@69.72.136.201:/home/kaizenmo/pm.ca/src/client/dist/ && \
ssh kaizenmo@69.72.136.201 "cp -r /home/kaizenmo/pm.ca/src/client/dist/* /home/kaizenmo/pm.ca/ && cloudlinux-selector restart --json --interpreter nodejs --domain pm.kpbc.ca --app-root pm.ca"
```

## Database

- **Engine:** MariaDB (via cPanel)
- **Database name:** `kaizenmo_pmassist`
- **User:** `kaizenmo_pmuser`
- **Host:** `localhost`

### Running Migrations

Migrations are run via SSH by piping SQL files to the MariaDB client:

```bash
ssh kaizenmo@69.72.136.201 "/usr/bin/mariadb -u kaizenmo_pmuser -p'<PASSWORD>' kaizenmo_pmassist < /path/to/migration.sql"
```

Or interactively:

```bash
ssh kaizenmo@69.72.136.201
/usr/bin/mariadb -u kaizenmo_pmuser -p'<PASSWORD>' kaizenmo_pmassist
```

### Table Requirements

All tables must use:

```sql
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Running a Local SQL File

To pipe a local migration file to the remote database:

```bash
cat migrations/001_example.sql | ssh kaizenmo@69.72.136.201 "/usr/bin/mariadb -u kaizenmo_pmuser -p'<PASSWORD>' kaizenmo_pmassist"
```

## Troubleshooting

### Check Application Status

```bash
ssh kaizenmo@69.72.136.201 "cloudlinux-selector status --json --interpreter nodejs --domain pm.kpbc.ca --app-root pm.ca"
```

### View Logs

Check the Passenger/Node.js error log via cPanel, or inspect stderr output in the application logs directory.

### Common Issues

1. **502 / Application not starting** -- Verify that `dist/server/index.js` exists and the Node.js app is started in cPanel. Check that all npm dependencies are installed on the server.

2. **Static files not updating** -- Make sure step 4 (copy to document root) was run. LiteSpeed serves from `/home/kaizenmo/pm.ca/`, not from `src/client/dist/`.

3. **Database connection errors** -- Verify `.env` credentials match the cPanel MySQL user/database. The database host must be `localhost`.

4. **CORS errors** -- Check that `CORS_ORIGIN` in `.env` matches the domain being accessed.

## Installing Dependencies on Server

If `package.json` changes (new dependencies), install them on the server:

```bash
ssh kaizenmo@69.72.136.201
cd /home/kaizenmo/pm.ca
source /home/kaizenmo/nodevenv/pm.ca/22/bin/activate
npm install --production
```

## Deployment Checklist

- [ ] `npm run build` completes without errors
- [ ] Server files uploaded to `dist/server/`
- [ ] Client files uploaded to `src/client/dist/`
- [ ] Client files copied to document root (`/home/kaizenmo/pm.ca/`)
- [ ] Application restarted via `cloudlinux-selector`
- [ ] Site loads at https://pm.kpbc.ca
- [ ] API endpoints respond (e.g., `/api/health`)
- [ ] Database queries work (login, data loading)
