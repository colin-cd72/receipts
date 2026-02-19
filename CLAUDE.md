# Receipt Upload App

## Overview
A receipt upload and processing app for TGL. Users upload receipts, which are analyzed by Claude AI to extract vendor, amount, date, and category. Receipts can be exported to CSV, Workday format, ZIP, or synced to Dropbox.

## Tech Stack
- Next.js 16 with App Router
- SQLite database (better-sqlite3)
- Claude API for receipt analysis
- Tailwind CSS for styling
- PM2 for process management

## Server Information

### Production Server
- **URL**: https://receipts.co-l.in
- **SSH Host**: 82.25.86.219
- **SSH User**: root
- **SSH Password**: Q/mj;kaWTT@H(VPk.mm7
- **App Path**: /home/receipts/htdocs/receipts.co-l.in
- **PM2**: Managed by root-level PM2 (`sudo pm2`)
- **Port**: 3002

### Deployment Commands

**IMPORTANT**: Because this app uses `better-sqlite3` (a native module), you MUST rebuild on the server. The macOS build won't work on Linux.

```bash
# 1. Deploy source files to server (from project root)
sshpass -p 'Q/mj;kaWTT@H(VPk.mm7' rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  --rsync-path="sudo rsync" \
  src package.json package-lock.json \
  root@82.25.86.219:/home/receipts/htdocs/receipts.co-l.in/

# 2. SSH to server and rebuild
sshpass -p 'Q/mj;kaWTT@H(VPk.mm7' ssh -o StrictHostKeyChecking=no root@82.25.86.219

# On server:
sudo bash -c "cd /home/receipts/htdocs/receipts.co-l.in && npm install && npm run build"
sudo pm2 restart receipts
```

### Quick Restart (no code changes)
```bash
sshpass -p 'Q/mj;kaWTT@H(VPk.mm7' ssh -o StrictHostKeyChecking=no \
  root@82.25.86.219 'sudo pm2 restart receipts'
```

### View Logs
```bash
sshpass -p 'Q/mj;kaWTT@H(VPk.mm7' ssh -o StrictHostKeyChecking=no \
  root@82.25.86.219 'sudo pm2 logs receipts --lines 50'
```

### PM2 Status (all apps)
```bash
sshpass -p 'Q/mj;kaWTT@H(VPk.mm7' ssh -o StrictHostKeyChecking=no \
  root@82.25.86.219 'sudo pm2 status'
```

## Directory Structure
```
/home/receipts/htdocs/receipts.co-l.in/
├── .next/              # Next.js build output (built on server)
├── data/
│   ├── receipts.db     # SQLite database
│   └── uploads/        # Uploaded receipt files
├── src/
│   ├── app/            # Next.js app router pages
│   │   ├── admin/      # Admin dashboard
│   │   └── api/        # API routes
│   ├── components/     # React components
│   └── lib/            # Shared utilities (db, claude, email, dropbox)
├── node_modules/       # Dependencies (installed on server)
├── .env                # Environment variables
├── ecosystem.config.js # PM2 configuration
└── package.json
```

## Key Features
- Receipt upload with AI processing
- Admin dashboard with search and gallery view
- CSV and Workday export formats
- ZIP download of all receipts
- Dropbox sync with duplicate detection
- Email notifications via SMTP
- Processing progress bar

## Environment Variables
Located in `/home/receipts/htdocs/receipts.co-l.in/.env`:
- `ANTHROPIC_API_KEY` - Claude API key for receipt analysis
- `ADMIN_PASSWORD` - Admin dashboard password (currently: jik3fep3)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` - Email config
- `NOTIFY_EMAIL` - Email address for notifications
- `DROPBOX_REFRESH_TOKEN` - Dropbox refresh token (recommended, never expires)
- `DROPBOX_APP_KEY` - Dropbox app key (required for refresh tokens)
- `DROPBOX_APP_SECRET` - Dropbox app secret (required for refresh tokens)
- `DROPBOX_ACCESS_TOKEN` - Legacy static token (optional, expires in 4 hours)
- `DROPBOX_FOLDER` - Dropbox folder path (default: /TGL/Receipts)

## Dropbox Setup (Refresh Tokens)

To set up Dropbox with refresh tokens (recommended - tokens auto-refresh):

1. Go to https://www.dropbox.com/developers/apps
2. Select your app (or create one with "Full Dropbox" access)
3. Note the **App key** and **App secret** from the Settings tab
4. Generate an authorization code by visiting this URL in your browser:
   ```
   https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&response_type=code&token_access_type=offline
   ```
5. After authorizing, copy the code and exchange it for tokens:
   ```bash
   curl -X POST https://api.dropbox.com/oauth2/token \
     -d code=YOUR_AUTH_CODE \
     -d grant_type=authorization_code \
     -d client_id=YOUR_APP_KEY \
     -d client_secret=YOUR_APP_SECRET
   ```
6. Add to `.env`:
   ```
   DROPBOX_APP_KEY=your_app_key
   DROPBOX_APP_SECRET=your_app_secret
   DROPBOX_REFRESH_TOKEN=the_refresh_token_from_step_5
   ```

The app will automatically refresh access tokens as needed.

## Troubleshooting

### Port already in use
If you see `EADDRINUSE: address already in use :::3002`:
```bash
sudo fuser -k 3002/tcp
sudo pm2 restart receipts
```

### Native module errors
If you see errors about `better-sqlite3` not found, rebuild on server:
```bash
sudo bash -c "cd /home/receipts/htdocs/receipts.co-l.in && npm rebuild better-sqlite3 && npm run build"
sudo pm2 restart receipts
```

### Check if app is running
```bash
curl http://localhost:3002/api/receipts | head -c 200
```
