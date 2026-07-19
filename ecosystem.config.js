module.exports = {
  apps: [
    {
      name: 'homecarehelp-backend',
      script: 'server.js',
      instances: 1, // keep at 1 — the partner e-sign/payment RAM cache and cron job are single-process, in-memory state
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true
    }
  ]
};
