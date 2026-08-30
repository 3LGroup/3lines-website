/**
 * pm2 config for the 3Lines site on EC2/Lightsail.
 *
 * `cwd` points at the `current` symlink, not a release directory, so a publish
 * swaps what pm2 serves by repointing that symlink — no config edit per deploy.
 */
module.exports = {
  apps: [
    {
      name: '3lines-site',
      cwd: '/srv/3lines/current',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        // Content is read from the persistent volume, never from the release.
        SOURCE_CONTENT_DIR: '/srv/3lines/content',
        CONTENT_DIR: '/srv/3lines/current/content',
        SITE_ORIGIN: 'https://www.3lines.com.sa',
      },
      error_file: '/srv/3lines/logs/site-error.log',
      out_file: '/srv/3lines/logs/site-out.log',
      time: true,
    },
  ],
};
