module.exports = {
  apps: [
    {
      name: "mameko-api",
      script: "./api.exe",
      cwd: "./",
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 20,
      out_file: "./backend.log",
      error_file: "./backend.log",
      merge_logs: true,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "mameko-tunnel",
      script: "./cloudflared.exe",
      args: "tunnel --protocol http2 --config config.yml run",
      cwd: "./",
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 30,
      out_file: "./tunnel.log",
      error_file: "./tunnel.log",
      merge_logs: true,
    }
  ]
};
