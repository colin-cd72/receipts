module.exports = {
  apps: [{
    name: 'receipts',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3002',
    cwd: '/home/receipts/htdocs/receipts.co-l.in',
    env: {
      NODE_ENV: 'production',
    },
  }, {
    name: 'receipts-smtp',
    script: 'inbound-smtp.js',
    cwd: '/home/receipts/htdocs/receipts.co-l.in',
    env: {
      NODE_ENV: 'production',
    },
    max_restarts: 10,
    restart_delay: 5000,
  }],
}
