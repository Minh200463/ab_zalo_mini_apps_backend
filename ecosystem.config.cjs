module.exports = {
  apps: [
    {
      name: "zalo-backend",
      cwd: "/var/www/zalo-miniapp/backend",
      script: "node_modules/.bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/pm2/zalo-backend-error.log",
      out_file: "/var/log/pm2/zalo-backend-out.log",
      merge_logs: true,
    },
  ],
};
