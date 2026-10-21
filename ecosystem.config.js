// pm2 process file for production. Two instances in cluster mode so `pm2 reload` restarts them
// one at a time: there is always one instance answering, so deploys cause no downtime.
module.exports = {
  apps: [
    {
      name: "workman-erp",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "cluster",
      instances: 2,
      kill_timeout: 8000,
      listen_timeout: 20000,
      max_memory_restart: "1500M",
      env: { NODE_ENV: "production" },
    },
  ],
};
