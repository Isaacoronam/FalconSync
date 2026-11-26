module.exports = {
  apps: [
    {
      name: 'falconsync-api',
      script: 'bin/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      // bin/server.js cierra con límite de 10 s; PM2 no debe cortarlo antes.
      kill_timeout: 11000,
      time: true,
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'falconsync-telegram',
      script: 'bin/telegramBot.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '256M',
      // El bot cierra el polling y el MCP hijo antes de terminar.
      kill_timeout: 11000,
      time: true,
      out_file: 'logs/telegram-out.log',
      error_file: 'logs/telegram-error.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
