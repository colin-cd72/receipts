# Deployment Guide for CloudPanel

## Prerequisites
- Node.js 18+ installed on server
- CloudPanel with Node.js site configured
- Domain `receipts.co-l.in` pointed to your server

## Setup Steps

### 1. Create Node.js Site in CloudPanel
1. Log into CloudPanel
2. Go to Sites → Add Site → Node.js
3. Set domain: `receipts.co-l.in`
4. Set Node.js version: 18 or 20
5. Set App Port: 3000

### 2. Clone/Upload Project
```bash
cd /home/receipts-co-l-in/htdocs
git clone <your-repo-url> .
# OR upload files via SFTP
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment
Create `.env` file:
```bash
cp .env.example .env
nano .env
```

Set your values:
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ADMIN_PASSWORD=your-secure-password-here
```

### 5. Build Application
```bash
npm run build
```

### 6. Configure PM2 (Process Manager)
CloudPanel uses PM2. Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'receipts',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: '/home/receipts-co-l-in/htdocs',
    env: {
      NODE_ENV: 'production',
    },
  }],
}
```

Start the app:
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 7. Configure Reverse Proxy
In CloudPanel, the Node.js site should automatically proxy to port 3000.

If manual nginx config needed, add to site config:
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 8. Enable SSL
In CloudPanel, go to your site → SSL/TLS → Actions → New Let's Encrypt Certificate

## File Structure on Server
```
/home/receipts-co-l-in/htdocs/
├── .env                 # Environment variables (create this)
├── .next/               # Build output
├── data/
│   ├── receipts.db      # SQLite database (auto-created)
│   └── uploads/         # Uploaded receipt images
├── node_modules/
├── src/
└── package.json
```

## Important Notes

### Data Persistence
- `data/receipts.db` - SQLite database with all receipt data
- `data/uploads/` - Uploaded receipt images
- **Back these up regularly!**

### Security Checklist
- [ ] Set strong ADMIN_PASSWORD
- [ ] Keep ANTHROPIC_API_KEY secret
- [ ] Enable SSL certificate
- [ ] Set proper file permissions:
  ```bash
  chmod 600 .env
  chmod 755 data/
  chmod 755 data/uploads/
  ```

### Updating
```bash
git pull
npm install
npm run build
pm2 restart receipts
```

## URLs
- Upload page: https://receipts.co-l.in/
- Admin dashboard: https://receipts.co-l.in/admin
- CSV Export: https://receipts.co-l.in/api/export?format=csv
- Workday Export: https://receipts.co-l.in/api/export?format=workday

## Troubleshooting

### Check logs
```bash
pm2 logs receipts
```

### Restart app
```bash
pm2 restart receipts
```

### Check if port is in use
```bash
lsof -i :3000
```

### Database issues
Database is created automatically. If corrupted:
```bash
rm data/receipts.db
pm2 restart receipts
```
(Note: This deletes all receipt data!)
