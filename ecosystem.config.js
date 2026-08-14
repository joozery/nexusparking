module.exports = {
  apps: [
    {
      name:   'parking-app',
      script: 'node_modules/.bin/next',
      args:   'start',
      cwd:    'C:\\parkingcar',
      env: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
    },
    {
      name:   'barrier-server',
      script: 'C:\\parkingcar\\barrier_server.js',
      cwd:    'C:\\parkingcar',
    },
  ],
}
