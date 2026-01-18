module.exports = {
  apps: [{
    name: 'receipts',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    cwd: '/home/receipts/htdocs/receipts.co-l.in',
    env: {
      NODE_ENV: 'production',
    },
  }],
}
